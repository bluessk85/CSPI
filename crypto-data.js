// CSPI 계산 및 암호화폐 데이터 처리 통합 모듈
// Python script.py와 JavaScript 기능을 하나로 통합

class CryptoDataProcessor {
    constructor() {
        this.apiEndpoints = {
            btc_price: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
            fear_greed: 'https://api.alternative.me/fng/',
            backup_btc: 'https://api.coinbase.com/v2/exchange-rates?currency=BTC'
        };

        this.marketData = {
            timestamp: new Date().toISOString(),
            btc_price: null,
            btc_price_previous: null,
            btc_change_24h: null,
            btc_market_cap: null,
            btc_volume: null,
            fear_greed_index: null,
            fear_greed_classification: null,
            mvrv_z_score: null,
            rsi_14d: null,
            altcoin_season_index: null,
            kimchi_premium: null,
            btc_dominance: null,
            cspi_score: null,
            cspi_level: null,
            cspi_recommendation: null
        };

        // 고속 크롤링 최적화
        this.CACHE_TTL = 1000 * 60; // 1분 캐시
        this.responseCache = new Map(); // url => {ts, data}
        this.maxConcurrency = 3; // 동시 요청 제한
        this.defaultTimeout = 6000; // 6초 타임아웃

        // 수동 새로고침 전용: 자동 초기화 비활성화
        this.isInitializing = false;
        console.log('✅ CryptoDataProcessor 생성 완료 - 고속 크롤링 모드');
    }

    // 캐시 관리
    getCached(key) {
        const hit = this.responseCache.get(key);
        return hit && Date.now() - hit.ts < this.CACHE_TTL ? hit.data : null;
    }

    setCached(key, data) {
        this.responseCache.set(key, { ts: Date.now(), data });
        // 캐시 크기 제한 (최대 50개)
        if (this.responseCache.size > 50) {
            const firstKey = this.responseCache.keys().next().value;
            this.responseCache.delete(firstKey);
        }
    }

    // 고속 프록시 레이서 - 가장 빠른 프록시만 사용
    async raceThroughProxies(targetUrl, config) {
        const cacheKey = `${config.name}:${targetUrl}`;

        // 캐시 확인
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`💾 ${config.name} 캐시 히트`);
            return cached;
        }

        // 프록시 목록 (AllOrigins만 사용 - 나머지는 모두 실패)
        const proxies = [
            url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
        ];

        // 각 프록시별 요청 생성
        const makeRequest = (proxyFn, index) => {
            const controller = new AbortController();

            // 하드 타임아웃 설정
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, config.timeout || this.defaultTimeout);

            return fetch(proxyFn(targetUrl), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                signal: controller.signal
            })
                .then(async response => {
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    // AllOrigins는 JSON 응답만 처리
                    const data = await response.json();
                    const htmlContent = data.contents;

                    if (!htmlContent || htmlContent.length < 100) {
                        throw new Error('HTML 내용이 비어있거나 너무 짧음');
                    }

                    console.log(`⚡ ${config.name} - 프록시 ${index + 1} 성공 (${htmlContent.length} chars)`);

                    // 데이터 추출
                    const result = config.extractor(htmlContent);

                    // 다른 요청들 취소
                    return result;
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    console.warn(`❌ ${config.name} - 프록시 ${index + 1} 실패:`, error.message);
                    throw error;
                });
        };

        try {
            // Promise.any로 가장 빠른 응답만 채택
            const requests = proxies.map((proxy, index) => makeRequest(proxy, index));
            const result = await Promise.any(requests);

            // 캐시 저장
            this.setCached(cacheKey, result);
            return result;

        } catch (error) {
            throw new Error(`모든 프록시 실패 - ${config.name}: ${error.message}`);
        }
    }

    // 실시간 데이터 초기화
    async initializeRealTimeData() {
        try {
            console.log('🚀 실시간 데이터 초기화 시작...');
            const result = await this.collectAllData();

            if (result.success !== false) {
                console.log('✅ 초기 실시간 데이터 로드 완료');
                console.log(`📊 BTC 가격: ${this.marketData.btc_price.toLocaleString()}`);
                console.log(`🪙 BTC 도미넌스: ${this.marketData.btc_dominance}%`);
                console.log(`🌊 알트코인 시즌: ${this.marketData.altcoin_season_index}/100`);
                console.log(`� RS터I: ${this.marketData.rsi_14d}`);
                console.log(`🌶️ 김치 프리미엄: ${this.marketData.kimchi_premium}%`);
                console.log(`📊 CSPI 점수: ${this.marketData.cspi_score}/100`);

                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('cryptoDataUpdated', {
                        detail: this.marketData
                    }));
                }
            }
        } catch (error) {
            console.error('❌ 초기 데이터 로드 실패:', error);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cryptoDataUpdated', {
                    detail: this.marketData
                }));
            }
        }
    }

    // BTC 가격 데이터 수집
    async fetchBTCPrice() {
        try {
            console.log('📡 BTC 가격 데이터 요청 중...');
            const response = await fetch(this.apiEndpoints.btc_price);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.bitcoin) {
                console.log('✅ BTC 데이터 수신 성공:', data.bitcoin);
                return {
                    price: data.bitcoin.usd,
                    change_24h: data.bitcoin.usd_24h_change || 0,
                    market_cap: data.bitcoin.usd_market_cap || 0,
                    volume: data.bitcoin.usd_24h_vol || 0
                };
            } else {
                throw new Error('Invalid BTC data format');
            }
        } catch (error) {
            console.error('❌ BTC 가격 데이터 오류:', error);
            return null;
        }
    }

    // Fear & Greed Index 수집
    async fetchFearGreedIndex() {
        try {
            console.log('📡 Fear & Greed Index 요청 중...');
            const response = await fetch(this.apiEndpoints.fear_greed);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                console.log('✅ Fear & Greed Index 수신 성공:', data.data[0]);
                return {
                    value: parseInt(data.data[0].value),
                    classification: data.data[0].value_classification
                };
            } else {
                throw new Error('Invalid Fear & Greed data format');
            }
        } catch (error) {
            console.error('❌ Fear & Greed Index 오류:', error);
            return null;
        }
    }

    // 최적화된 웹 크롤링 함수
    async fetchWithOptimizedCrawling(targetUrl, config) {
        const proxyServices = [
            {
                name: 'AllOrigins',
                url: 'https://api.allorigins.win/get?url=',
                parseResponse: async (response) => {
                    const data = await response.json();
                    return data.contents;
                }
            },
            {
                name: 'ThingProxy',
                url: 'https://thingproxy.freeboard.io/fetch/',
                parseResponse: async (response) => response.text()
            },
            {
                name: 'CORS.SH',
                url: 'https://proxy.cors.sh/',
                parseResponse: async (response) => response.text()
            }
        ];

        for (let proxy of proxyServices) {
            try {
                console.log(`🔄 ${proxy.name} 프록시로 ${config.name} 데이터 요청 중...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const proxyUrl = proxy.url + encodeURIComponent(targetUrl);
                const response = await fetch(proxyUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const htmlContent = await proxy.parseResponse(response);

                if (!htmlContent || htmlContent.length < 100) {
                    throw new Error('HTML 내용이 비어있거나 너무 짧음');
                }

                console.log(`✅ ${proxy.name} 프록시 성공 - HTML 크기: ${htmlContent.length}`);

                // HTML 파싱 및 데이터 추출
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');

                return config.extractData(doc, htmlContent);

            } catch (error) {
                console.warn(`❌ ${proxy.name} 프록시 실패:`, error.message);
                continue;
            }
        }

        throw new Error(`모든 프록시 서비스 실패 - ${config.name}`);
    }



    // MVRV Z-Score 수집 (Playwright API 서버 사용)
    async fetchMVRVZScore() {
        try {
            console.log('📡 MVRV API 서버로 요청 시작...');
            
            const response = await fetch('http://localhost:3001/api/mvrv', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(15000) // 15초 타임아웃
            });

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(`API 오류: ${data.error}`);
            }

            const mvrvValue = data.data.mvrv_z_score;
            console.log(`✅ MVRV API에서 수집 성공: ${mvrvValue}`);
            
            return mvrvValue;
            
        } catch (error) {
            console.error('❌ MVRV API 요청 실패:', error);
            
            // 백업: 기존 프록시 방식으로 폴백
            console.log('🔄 백업 방식으로 시도 중...');
            try {
                return await this.fetchMVRVZScoreBackup();
            } catch (backupError) {
                console.error('❌ 백업 방식도 실패:', backupError);
                throw new Error(`MVRV 수집 완전 실패 - API: ${error.message}, 백업: ${backupError.message}`);
            }
        }
    }

    // 백업용 MVRV 수집 메서드 (기존 방식)
    async fetchMVRVZScoreBackup() {
        console.log('🔄 MVRV 백업 방식 (프록시) 사용...');
        
        const timestamp = Date.now();
        const url = `https://en.macromicro.me/charts/30335/bitcoin-mvrv-zscore?t=${timestamp}`;
        
        const result = await this.raceThroughProxies(url, {
            name: 'MVRV_백업',
            timeout: 10000,
            extractor: (html) => {
                // 간단한 정규식만 사용
                const mvrvPatterns = [
                    /class="val"[^>]*?>(-?\d+\.?\d*)</gi,
                    /"val"[^>]*?>(-?\d+\.?\d*)</gi
                ];

                for (let pattern of mvrvPatterns) {
                    const matches = html.match(pattern);
                    if (matches) {
                        for (let match of matches) {
                            const numMatch = match.match(/(-?\d+\.?\d*)/);
                            if (numMatch) {
                                const value = parseFloat(numMatch[1]);
                                if (!isNaN(value) && value >= -5 && value <= 15) {
                                    console.log(`⚡ MVRV 백업으로 발견: ${value}`);
                                    return value;
                                }
                            }
                        }
                    }
                }

                throw new Error('MVRV 백업 값 파싱 실패');
            }
        });

        return result;
    }

    // 개선된 지표 수집 시스템 (김치프리미엄 + MVRV)
    async collectIndicatorsFast() {
        console.log('🚀 지표 수집 시작 (김치프리미엄 + MVRV)...');

        const results = {};
        let successCount = 0;

        // 김치프리미엄 수집
        try {
            results.kimchiPremium = await this.fetchKimchiPremium();
            this.marketData.kimchi_premium = results.kimchiPremium;
            console.log(`✅ 김치프리미엄: ${results.kimchiPremium}%`);
            successCount++;
        } catch (error) {
            console.error('❌ 김치프리미엄 수집 실패:', error);
            this.marketData.kimchi_premium = null;
        }

        // MVRV Z-Score 수집
        try {
            results.mvrvZScore = await this.fetchMVRVZScore();
            this.marketData.mvrv_z_score = results.mvrvZScore;
            console.log(`✅ MVRV Z-Score: ${results.mvrvZScore}`);
            successCount++;
        } catch (error) {
            console.error('❌ MVRV Z-Score 수집 실패:', error);
            this.marketData.mvrv_z_score = null;
        }
        
        // 다른 지표들은 null로 설정
        this.marketData.rsi_14d = null;
        this.marketData.altcoin_season_index = null;
        this.marketData.btc_dominance = null;
        
        console.log(`🎯 지표 수집 완료: ${successCount}/2 성공`);
        return { successCount, totalCount: 2, duration: 0 };
    }

    // 레거시 호환성을 위한 래퍼
    async updateCalculatedIndicators() {
        return await this.collectIndicatorsFast();
    }

    // 김치프리미엄 수집 (coinpaprika.com만 사용 - 유일하게 작동하는 소스)
    async fetchKimchiPremium() {
        try {
            console.log('🌶️ 김치프리미엄 데이터 수집 시작...');
            
            const result = await this.raceThroughProxies('https://coinpaprika.com/exchanges/bithumb/', {
                name: '김치프리미엄',
                timeout: 6000,
                extractor: (html) => {
                    // 퍼센트 값 찾기 (간단한 패턴만 사용)
                    const percentMatches = html.match(/[-+]?\d+\.?\d*%/g) || [];
                    const candidates = percentMatches
                        .filter(m => !m.includes('{{') && !m.includes('}}'))
                        .map(m => parseFloat(m.replace('%', '')))
                        .filter(v => !isNaN(v) && Math.abs(v) < 15);

                    if (candidates.length > 0) {
                        console.log(`⚡ 김치프리미엄 발견: ${candidates[0]}%`);
                        return candidates[0];
                    }

                    throw new Error('김치프리미엄 값 파싱 실패');
                }
            });

            console.log(`✅ 김치프리미엄 수집 성공: ${result}%`);
            return result;
            
        } catch (error) {
            console.error('❌ 김치프리미엄 수집 실패:', error);
            throw error;
        }
    }

    // CSPI 점수 계산 (실제 값만 사용 - null 값은 계산에서 제외)
    calculateCSPIScore(indicators) {
        const weights = {
            mvrv: 0.30,
            altseason: 0.25,
            kimchi: 0.20,
            btc_dom: 0.15,
            fear_greed: 0.05,
            rsi: 0.05
        };

        // 실제 값만 사용 - null 값은 계산에서 제외
        const validIndicators = {};
        const normalizedScores = {};
        let totalWeight = 0;

        // MVRV Z-Score
        if (indicators.mvrv_z_score !== null) {
            validIndicators.mvrv = indicators.mvrv_z_score;
            normalizedScores.mvrv = Math.min((indicators.mvrv_z_score / 12.0) * 100, 100);
            totalWeight += weights.mvrv;
        }

        // Fear & Greed Index
        if (indicators.fear_greed_index !== null) {
            validIndicators.fear_greed = indicators.fear_greed_index;
            normalizedScores.fear_greed = indicators.fear_greed_index;
            totalWeight += weights.fear_greed;
        }

        // 알트코인 시즌 인덱스
        if (indicators.altcoin_season_index !== null) {
            validIndicators.altseason = indicators.altcoin_season_index;
            normalizedScores.altseason = indicators.altcoin_season_index;
            totalWeight += weights.altseason;
        }

        // RSI
        if (indicators.rsi_14d !== null) {
            validIndicators.rsi = indicators.rsi_14d;
            normalizedScores.rsi = indicators.rsi_14d;
            totalWeight += weights.rsi;
        }

        // 김치 프리미엄
        if (indicators.kimchi_premium !== null) {
            validIndicators.kimchi = indicators.kimchi_premium;
            normalizedScores.kimchi = Math.max(0, Math.min(100, ((indicators.kimchi_premium + 20) / 40) * 100));
            totalWeight += weights.kimchi;
        }

        // BTC 도미넌스
        if (indicators.btc_dominance !== null) {
            validIndicators.btc_dom = indicators.btc_dominance;
            normalizedScores.btc_dom = Math.max(0, Math.min(100, ((70 - indicators.btc_dominance) / 35) * 100));
            totalWeight += weights.btc_dom;
        }

        const validDataCount = Object.keys(validIndicators).length;
        console.log(`📊 유효한 데이터 개수: ${validDataCount}/6`);
        console.log(`📊 총 가중치: ${totalWeight.toFixed(2)}`);

        // 유효한 데이터가 없으면 null 반환
        if (validDataCount === 0) {
            return {
                total_score: null,
                normalized_values: {},
                contributions: {},
                valid_data_count: 0,
                total_weight: 0
            };
        }

        // 유효한 데이터만으로 CSPI 점수 계산
        let cspiScore = 0;
        const contributions = {};
        const normalizedValues = {};

        // 각 지표별로 기여도 계산 (실제 값만)
        Object.keys(normalizedScores).forEach(key => {
            const originalWeight = weights[key];
            const adjustedWeight = originalWeight / totalWeight; // 가중치 재조정
            const contribution = normalizedScores[key] * adjustedWeight;

            cspiScore += contribution;
            contributions[key] = Math.round(contribution * 10) / 10;
            normalizedValues[key] = Math.round(normalizedScores[key] * 10) / 10;
        });

        // 이미 adjustedWeight에서 정규화했으므로 추가 스케일링 불필요

        return {
            total_score: Math.round(cspiScore * 10) / 10,
            normalized_values: normalizedValues,
            contributions: contributions,
            valid_data_count: validDataCount,
            total_weight: Math.round(totalWeight * 100) / 100
        };
    }

    // 매도 신호 확인
    checkSellSignals(marketData) {
        const mvrv = marketData.mvrv_z_score;
        const fearGreed = marketData.fear_greed_index;

        return {
            stage_1: {
                condition: 'MVRV ≥ 5.0',
                active: mvrv >= 5.0,
                distance: 5.0 - mvrv
            },
            stage_2: {
                condition: 'MVRV ≥ 6.0 + F&G ≥ 85',
                active: mvrv >= 6.0 && fearGreed >= 85,
                distance: 6.0 - mvrv
            },
            stage_3: {
                condition: 'MVRV ≥ 7.5 + 복합신호 ≥ 85',
                active: mvrv >= 7.5,
                distance: 7.5 - mvrv
            },
            stage_4: {
                condition: 'MVRV ≥ 9.0',
                active: mvrv >= 9.0,
                distance: 9.0 - mvrv
            }
        };
    }

    // 전체 데이터 수집 및 처리
    async collectAllData() {
        console.log('🎯 전체 데이터 수집 시작...');

        try {
            const btcData = await this.fetchBTCPrice();
            const fearGreedData = await this.fetchFearGreedIndex();

            if (btcData) {
                this.marketData.btc_price_previous = this.marketData.btc_price;
                this.marketData.btc_price = btcData.price;
                this.marketData.btc_change_24h = btcData.change_24h;
                this.marketData.btc_market_cap = btcData.market_cap || this.marketData.btc_market_cap;
                this.marketData.btc_volume = btcData.volume || this.marketData.btc_volume;
                console.log(`✅ BTC 가격: ${btcData.price.toLocaleString()}`);
            }

            if (fearGreedData) {
                this.marketData.fear_greed_index = fearGreedData.value;
                this.marketData.fear_greed_classification = fearGreedData.classification;
                console.log(`✅ Fear & Greed Index: ${fearGreedData.value} (${fearGreedData.classification})`);
            }

            await this.updateCalculatedIndicators();

            // CSPI 점수 계산 (실제 값만 사용)
            const cspiResult = this.calculateCSPIScore(this.marketData);

            if (cspiResult.total_score === null) {
                // 유효한 데이터가 없는 경우
                this.marketData.cspi_score = null;
                this.marketData.cspi_level = "NO_DATA";
                this.marketData.cspi_recommendation = "데이터 수집 중...";
                console.log('⚠️ CSPI 계산 불가 - 유효한 데이터 없음');
            } else {
                // 유효한 데이터로 CSPI 계산 완료
                this.marketData.cspi_score = cspiResult.total_score;

                if (cspiResult.valid_data_count < 4) {
                    this.marketData.cspi_level = "PARTIAL";
                    this.marketData.cspi_recommendation = `부분 데이터 기반 (${cspiResult.valid_data_count}/6)`;
                } else {
                    // 정상적인 CSPI 레벨 계산
                    if (this.marketData.cspi_score < 25) {
                        this.marketData.cspi_level = "LOW";
                        this.marketData.cspi_recommendation = "적극적 매수";
                    } else if (this.marketData.cspi_score < 45) {
                        this.marketData.cspi_level = "MEDIUM-LOW";
                        this.marketData.cspi_recommendation = "점진적 매수";
                    } else if (this.marketData.cspi_score < 65) {
                        this.marketData.cspi_level = "MEDIUM";
                        this.marketData.cspi_recommendation = "관망";
                    } else if (this.marketData.cspi_score < 80) {
                        this.marketData.cspi_level = "MEDIUM-HIGH";
                        this.marketData.cspi_recommendation = "부분 매도";
                    } else {
                        this.marketData.cspi_level = "HIGH";
                        this.marketData.cspi_recommendation = "적극적 매도";
                    }
                }

                console.log(`✅ CSPI 계산 완료: ${this.marketData.cspi_score}/100 (${cspiResult.valid_data_count}/6 지표 사용)`);
            }

            this.marketData.timestamp = new Date().toISOString();

            console.log('🎯 데이터 수집 완료');

            if (this.marketData.cspi_score !== null) {
                console.log(`📊 현재 CSPI 점수: ${this.marketData.cspi_score}/100`);
                console.log(`🎚️ 위험 수준: ${this.marketData.cspi_level}`);
                console.log(`💡 투자 권고: ${this.marketData.cspi_recommendation}`);
            } else {
                console.log('⚠️ CSPI 점수 계산 불가 - 중요 API 데이터 누락 (투자 안전성)');
            }

            return {
                success: true,
                data: this.marketData,
                cspi_analysis: cspiResult,
                sell_signals: this.checkSellSignals(this.marketData)
            };

        } catch (error) {
            console.error('❌ 데이터 수집 오류:', error);
            return {
                success: false,
                error: error.message,
                data: this.marketData
            };
        }
    }

    // 통합 데이터 수집 (기존 호환성)
    async collectAllDataUnified(forceUpdate = false) {
        return await this.collectAllData();
    }

    // 현재 데이터 반환
    getCurrentData() {
        return this.marketData;
    }

    // 지표 테스트 함수 (디버깅용)
    async testIndicator(indicatorName) {
        console.log(`🧪 ${indicatorName} 테스트 시작...`);
        
        try {
            let result;
            switch (indicatorName) {
                case 'kimchi':
                    result = await this.fetchKimchiPremium();
                    break;
                case 'mvrv':
                    result = await this.fetchMVRVZScore();
                    break;
                default:
                    console.log(`❌ ${indicatorName} 지표는 지원하지 않습니다 (kimchi, mvrv만 작동)`);
                    return null;
            }
            
            console.log(`✅ ${indicatorName} 테스트 성공:`, result);
            return result;
        } catch (error) {
            console.error(`❌ ${indicatorName} 테스트 실패:`, error);
            return null;
        }
    }

    // 기본 API 테스트 (CoinGecko, Fear & Greed)
    async testBasicAPIs() {
        console.log('🧪 기본 API 테스트 시작...');

        try {
            const btcData = await this.fetchBTCPrice();
            console.log('✅ BTC 가격 API 성공:', btcData);
        } catch (error) {
            console.error('❌ BTC 가격 API 실패:', error);
        }

        try {
            const fearGreedData = await this.fetchFearGreedIndex();
            console.log('✅ Fear & Greed API 성공:', fearGreedData);
        } catch (error) {
            console.error('❌ Fear & Greed API 실패:', error);
        }
    }

    // 김치프리미엄 개선된 파싱 테스트
    async testKimchiPremiumParsing() {
        console.log('🌶️ 김치프리미엄 개선된 파싱 테스트 시작...');
        
        try {
            const result = await this.fetchKimchiPremium();
            console.log('✅ 김치프리미엄 테스트 성공:', result + '%');
            return result;
        } catch (error) {
            console.error('❌ 김치프리미엄 테스트 실패:', error);
            return null;
        }
    }
}

// 전역 인스턴스 생성
if (typeof window !== 'undefined') {
    window.cryptoDataProcessor = new CryptoDataProcessor();
    console.log('✅ CryptoDataProcessor 전역 인스턴스 생성 완료');
}

// Node.js 환경에서도 사용 가능하도록
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoDataProcessor;
}