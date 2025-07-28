// 통합된 암호화폐 대시보드 - 모든 기능을 하나로 통합
// crypto-data.js의 CryptoDataProcessor + UI 기능 완전 통합

// Global variables
let cspiGauge = null;
let historicalChart = null;
let countdownInterval = null;
let autoUpdateInterval = null;

// App data storage - CryptoDataProcessor에서 관리 (하드코딩 제거 - 투자 안전성)
let appData = {
    timestamp: getCurrentTimestamp(),
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

function getCurrentTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function () {
    initializeDashboard();

    // 수동 새로고침 전용: 초기 데이터 자동 로드 비활성화
    window.addEventListener('cryptoDataInitialized', function (event) {
        console.log('🎉 수동 데이터 로드 완료!');
        Object.assign(appData, event.detail);
        updateAllUIComponents();
        hideInitialLoadingState();
    });

    // CryptoDataProcessor에서 데이터 업데이트 이벤트 수신
    window.addEventListener('cryptoDataUpdated', function (event) {
        console.log('🔄 실시간 데이터 업데이트 이벤트 수신');
        Object.assign(appData, event.detail);
        updateAllUIComponents();
        hideInitialLoadingState();
    });
});

function initializeDashboard() {
    // 초기 로딩 상태 표시
    showInitialLoadingState();

    updateHeaderValues();
    initializeCSPIGauge();
    initializeHistoricalChart();
    updateIndicatorCards();
    startCountdownTimer();
    setupEventListeners();
    updateDataValidationStatus();
}

// 수동 새로고침 모드 초기 상태 표시
function showInitialLoadingState() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.textContent = '🔄 수동 새로고침';
        refreshBtn.disabled = false;
    }

    // 헤더에 수동 새로고침 메시지 표시
    const lastUpdateElement = document.getElementById('lastUpdateTime');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = '수동 새로고침 버튼을 눌러주세요';
    }

    // 모든 지표 카드에 수동 새로고침 필요 메시지 표시
    const indicators = ['mvrv', 'altseason', 'kimchi', 'dominance', 'fearGreed', 'rsi'];
    indicators.forEach(indicator => {
        const valueElement = document.getElementById(`${indicator}Value`);
        if (valueElement) {
            valueElement.textContent = '새로고침 필요';
        }
    });
}

// 초기 로딩 상태 숨기기
function hideInitialLoadingState() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.textContent = '🔄 수동 새로고침';
        refreshBtn.disabled = false;
    }
}

// Initial data loading using CryptoDataProcessor
async function loadInitialData() {
    console.log('🔄 초기 데이터 로드 중...');

    try {
        if (window.cryptoDataProcessor) {
            // CryptoDataProcessor 초기화 대기
            let attempts = 0;
            const maxAttempts = 50; // 5초 대기

            while (window.cryptoDataProcessor.isInitializing && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            // 현재 데이터 가져오기
            let currentData = window.cryptoDataProcessor.getCurrentData();

            // 데이터가 오래되었거나 초기화가 실패했다면 강제 로드
            if (!currentData.timestamp || new Date(currentData.timestamp) < new Date(Date.now() - 300000)) {
                console.log('🔄 실시간 데이터 강제 로드...');
                const result = await window.cryptoDataProcessor.collectAllData();
                if (result.success !== false) {
                    currentData = result.data || result;
                }
            }

            // appData 업데이트
            Object.assign(appData, currentData);

            // UI 즉시 업데이트
            updateAllUIComponents();

            // 로딩 상태 해제
            hideInitialLoadingState();

            console.log(`✅ 초기 데이터 로드 완료: $${appData.btc_price.toLocaleString()}`);
            console.log(`📊 실시간 지표 현황:`);
            console.log(`  • BTC 도미넌스: ${appData.btc_dominance}%`);
            console.log(`  • 알트코인 시즌: ${appData.altcoin_season_index}/100`);
            console.log(`  • RSI (14일): ${appData.rsi_14d}`);
            console.log(`  • 김치 프리미엄: ${appData.kimchi_premium}%`);
            console.log(`  • MVRV Z-Score: ${appData.mvrv_z_score}`);
            console.log(`  • Fear & Greed: ${appData.fear_greed_index} (${appData.fear_greed_classification})`);
        }
    } catch (error) {
        console.error('❌ 초기 데이터 로드 실패:', error);
        // 실패해도 기본 UI는 표시
        updateAllUIComponents();
        hideInitialLoadingState();
    }
}

// 초기 로딩 상태 해제
function hideInitialLoadingState() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.textContent = '🔄 수동 새로고침';
        refreshBtn.disabled = false;
    }
}

// Main real-time data update function - CryptoDataProcessor 사용
async function updateRealTimeData() {
    console.log('🚀 실시간 데이터 업데이트 시작...');

    showLoadingIndicator();

    try {
        if (window.cryptoDataProcessor) {
            console.log('📊 통합 데이터 프로세서 사용 중...');
            const result = await window.cryptoDataProcessor.collectAllDataUnified(false);

            if (result.success !== false) {
                const newData = result.data || result;
                Object.assign(appData, newData);

                console.log('✅ 통합 데이터 프로세서로 업데이트 완료');
                showSuccessMessage('실시간 데이터가 성공적으로 업데이트되었습니다');
            } else {
                throw new Error('통합 데이터 프로세서 실패');
            }
        } else {
            throw new Error('CryptoDataProcessor를 찾을 수 없습니다');
        }

        // Update timestamp
        appData.timestamp = getCurrentTimestamp();

        // Update all UI components with new data
        updateAllUIComponents();

    } catch (error) {
        console.error('❌ 데이터 업데이트 오류:', error);
        showErrorMessage('데이터 업데이트 중 오류가 발생했습니다. 하드코딩된 데이터 표시 금지.');

        // 하드코딩 데이터 사용 금지 - 투자 안전성을 위해 오류 상태 유지
        console.log('⚠️ API 실패 - 하드코딩된 백업 데이터 사용 금지 (투자 안전성)');
        appData.timestamp = getCurrentTimestamp();
        updateAllUIComponents();
    } finally {
        hideLoadingIndicator();
    }
}

function updateAllUIComponents() {
    updateHeaderValues();
    initializeCSPIGauge();
    updateIndicatorCards();
    updateDataValidationStatus();
    console.log('🔄 모든 UI 컴포넌트 업데이트 완료');
}

// UI 업데이트 함수들 (기존 app.js에서 가져옴)
function updateHeaderValues() {
    // BTC 가격 표시 (null 체크 - 투자 안전성)
    document.getElementById('headerBtcPrice').textContent = appData.btc_price ? `${Math.round(appData.btc_price).toLocaleString()}` : 'API 데이터 없음';

    // CSPI 점수 표시 (null 체크 - 투자 안전성)
    if (appData.cspi_score !== null) {
        document.getElementById('headerCSPIScore').textContent = `${appData.cspi_score.toFixed(1)}/100`;
    } else {
        document.getElementById('headerCSPIScore').textContent = '로딩 중...';
    }

    if (appData.cspi_level === 'NO_DATA') {
        document.getElementById('headerMarketPhase').textContent = '🔄 데이터 수집 중';
    } else if (appData.cspi_level === 'PARTIAL') {
        document.getElementById('headerMarketPhase').textContent = '🟡 부분 데이터';
    } else if (appData.cspi_level) {
        document.getElementById('headerMarketPhase').textContent = `🟢 ${appData.cspi_level}`;
    } else {
        document.getElementById('headerMarketPhase').textContent = '로딩 중...';
    }
    document.getElementById('lastUpdateTime').textContent = appData.timestamp;

    document.getElementById('cspiScoreValue').textContent = appData.cspi_score ? appData.cspi_score.toFixed(1) : 'API 실패';
    document.getElementById('cspiStatus').textContent = appData.cspi_level ? `🟢 ${appData.cspi_level}` : '❌ 계산 불가';
    document.getElementById('cspiDescription').textContent = appData.cspi_recommendation || 'API 데이터 부족으로 투자 권고 불가';

    if (appData.cspi_score !== null) {
        const progressToPeak = (appData.cspi_score / 100) * 100;
        const remainingUpside = 100 - appData.cspi_score;
        document.getElementById('progressValue').textContent = `${progressToPeak.toFixed(1)}%`;
        document.getElementById('upsideValue').textContent = `${remainingUpside.toFixed(1)}포인트`;
        document.getElementById('riskValue').textContent = appData.cspi_score < 50 ? '낮음' : '보통';
    } else {
        document.getElementById('progressValue').textContent = 'API 실패';
        document.getElementById('upsideValue').textContent = 'API 실패';
        document.getElementById('riskValue').textContent = 'API 실패';
    }
}

function initializeCSPIGauge() {
    const canvas = document.getElementById('cspiGauge');
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = rect.width / 2;
    const centerY = rect.height - 20;
    const radius = Math.min(rect.width, rect.height) * 0.35;
    const score = appData.cspi_score || 0;

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw gauge background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#30363d';
    ctx.stroke();

    // Define color segments
    const segments = [
        { start: 0, end: 25, color: '#58a6ff' },
        { start: 25, end: 45, color: '#56d364' },
        { start: 45, end: 65, color: '#d4951a' },
        { start: 65, end: 80, color: '#ffa657' },
        { start: 80, end: 100, color: '#f85149' }
    ];

    // Draw gauge segments
    segments.forEach(segment => {
        const startAngle = Math.PI + (segment.start / 100) * Math.PI;
        const endAngle = Math.PI + (segment.end / 100) * Math.PI;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineWidth = 20;
        ctx.strokeStyle = segment.color;
        ctx.stroke();
    });

    // Draw current score indicator
    const scoreAngle = Math.PI + (score / 100) * Math.PI;
    const indicatorX = centerX + Math.cos(scoreAngle) * (radius + 15);
    const indicatorY = centerY + Math.sin(scoreAngle) * (radius + 15);

    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#f0f6fc';
    ctx.fill();
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw score labels
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'center';

    ctx.fillText('0', centerX - radius, centerY + 15);
    ctx.fillText('25', centerX - radius * 0.7, centerY - radius * 0.7);
    ctx.fillText('50', centerX, centerY - radius - 10);
    ctx.fillText('75', centerX + radius * 0.7, centerY - radius * 0.7);
    ctx.fillText('100', centerX + radius, centerY + 15);
}

function initializeHistoricalChart() {
    const ctx = document.getElementById('historicalChart').getContext('2d');

    if (historicalChart) {
        historicalChart.destroy();
    }

    const chartData = {
        labels: ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
        datasets: [
            {
                label: '2017 사이클',
                data: [20, 25, 30, 35, 45, 55, 70, 85, 95, 92, 88],
                borderColor: '#1FB8CD',
                backgroundColor: 'rgba(31, 184, 205, 0.1)',
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: false
            },
            {
                label: '2021 사이클',
                data: [18, 22, 28, 38, 48, 58, 68, 78, 92, 89, 85],
                borderColor: '#FFC185',
                backgroundColor: 'rgba(255, 193, 133, 0.1)',
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: false
            },
            {
                label: '2025 사이클 (현재)',
                data: [15, 20, 25, 32, appData.cspi_score || 0, null, null, null, null, null, null],
                borderColor: '#B4413C',
                backgroundColor: 'rgba(180, 65, 60, 0.1)',
                tension: 0.4,
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 10,
                fill: false,
                borderDash: [5, 5]
            }
        ]
    };

    historicalChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    titleColor: '#f0f6fc',
                    bodyColor: '#f0f6fc',
                    borderColor: '#58a6ff',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1) + ' CSPI';
                            } else {
                                label += '예측 구간';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: '#30363d',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#8b949e'
                    },
                    title: {
                        display: true,
                        text: '사이클 진행률',
                        color: '#8b949e',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    grid: {
                        color: '#30363d',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#8b949e',
                        callback: function (value) {
                            return value.toFixed(0);
                        }
                    },
                    title: {
                        display: true,
                        text: 'CSPI 점수',
                        color: '#8b949e',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

function updateIndicatorCards() {
    // Update MVRV Z-Score card (null 체크 - 투자 안전성)
    if (appData.mvrv_z_score !== null) {
        const mvrvNormalized = Math.min(100, (appData.mvrv_z_score / 10) * 100);
        document.getElementById('mvrvValue').textContent = appData.mvrv_z_score.toFixed(2);
        document.getElementById('mvrvNormalized').textContent = `${mvrvNormalized.toFixed(1)}/100`;
        document.getElementById('mvrvStatus').textContent = appData.mvrv_z_score < 5 ? "안전 축적 구간" : "주의 구간";
        document.getElementById('mvrvContribution').textContent = `기여도: ${(mvrvNormalized * 0.3).toFixed(1)}`;
    } else {
        document.getElementById('mvrvValue').textContent = '❌ API 실패';
        document.getElementById('mvrvNormalized').textContent = '데이터 없음';
        document.getElementById('mvrvStatus').textContent = 'MacroMicro API 파싱 실패';
        document.getElementById('mvrvContribution').textContent = '계산 불가';
    }

    // Update altcoin season card
    if (appData.altcoin_season_index !== null) {
        document.getElementById('altseasonValue').textContent = Math.round(appData.altcoin_season_index);
        document.getElementById('altseasonNormalized').textContent = `${Math.round(appData.altcoin_season_index)}/100`;
        document.getElementById('altseasonStatus').textContent = appData.altcoin_season_index > 75 ? "Altcoin Season" : "Bitcoin Season";
        document.getElementById('altseasonContribution').textContent = `기여도: ${(appData.altcoin_season_index * 0.25).toFixed(1)}`;
    } else {
        document.getElementById('altseasonValue').textContent = '로딩 중...';
        document.getElementById('altseasonNormalized').textContent = '로딩 중...';
        document.getElementById('altseasonStatus').textContent = '로딩 중...';
        document.getElementById('altseasonContribution').textContent = '로딩 중...';
    }

    // Update kimchi premium card
    if (appData.kimchi_premium !== null) {
        const kimchiNormalized = Math.max(0, Math.min(100, 50 + appData.kimchi_premium * 2));
        document.getElementById('kimchiValue').textContent = `${appData.kimchi_premium.toFixed(2)}%`;
        document.getElementById('kimchiNormalized').textContent = `${kimchiNormalized.toFixed(1)}/100`;
        document.getElementById('kimchiStatus').textContent = appData.kimchi_premium < 0 ? "역김치프리미엄" : "김치프리미엄";
        document.getElementById('kimchiContribution').textContent = `기여도: ${(kimchiNormalized * 0.2).toFixed(1)}`;
    } else {
        document.getElementById('kimchiValue').textContent = '로딩 중...';
        document.getElementById('kimchiNormalized').textContent = '로딩 중...';
        document.getElementById('kimchiStatus').textContent = '로딩 중...';
        document.getElementById('kimchiContribution').textContent = '로딩 중...';
    }

    // Update BTC dominance card
    if (appData.btc_dominance !== null) {
        const dominanceNormalized = Math.max(0, 100 - appData.btc_dominance);
        document.getElementById('dominanceValue').textContent = `${appData.btc_dominance.toFixed(1)}%`;
        document.getElementById('dominanceNormalized').textContent = `${dominanceNormalized.toFixed(1)}/100`;
        document.getElementById('dominanceStatus').textContent = appData.btc_dominance > 60 ? "비트코인 강세" : "알트코인 강세";
        document.getElementById('dominanceContribution').textContent = `기여도: ${(dominanceNormalized * 0.15).toFixed(1)}`;
    } else {
        document.getElementById('dominanceValue').textContent = '로딩 중...';
        document.getElementById('dominanceNormalized').textContent = '로딩 중...';
        document.getElementById('dominanceStatus').textContent = '로딩 중...';
        document.getElementById('dominanceContribution').textContent = '로딩 중...';
    }

    // Update fear & greed card
    if (appData.fear_greed_index !== null) {
        document.getElementById('fearGreedValue').textContent = appData.fear_greed_index;
        document.getElementById('fearGreedNormalized').textContent = `${appData.fear_greed_index}/100`;
        document.getElementById('fearGreedStatus').textContent = appData.fear_greed_classification || '로딩 중...';
        document.getElementById('fearGreedContribution').textContent = `기여도: ${(appData.fear_greed_index * 0.05).toFixed(1)}`;
    } else {
        document.getElementById('fearGreedValue').textContent = '로딩 중...';
        document.getElementById('fearGreedNormalized').textContent = '로딩 중...';
        document.getElementById('fearGreedStatus').textContent = '로딩 중...';
        document.getElementById('fearGreedContribution').textContent = '로딩 중...';
    }

    // Update RSI card
    if (appData.rsi_14d !== null) {
        document.getElementById('rsiValue').textContent = appData.rsi_14d.toFixed(1);
        document.getElementById('rsiNormalized').textContent = `${appData.rsi_14d.toFixed(1)}/100`;
        document.getElementById('rsiStatus').textContent = appData.rsi_14d > 70 ? '과매수' : appData.rsi_14d < 30 ? '과매도' : '중립';
        document.getElementById('rsiContribution').textContent = `기여도: ${(appData.rsi_14d * 0.05).toFixed(1)}`;
    } else {
        document.getElementById('rsiValue').textContent = '로딩 중...';
        document.getElementById('rsiNormalized').textContent = '로딩 중...';
        document.getElementById('rsiStatus').textContent = '로딩 중...';
        document.getElementById('rsiContribution').textContent = '로딩 중...';
    }


}

// Loading and message functions
function showLoadingIndicator() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.classList.add('loading');
    refreshBtn.textContent = '🔄 실시간 데이터 가져오는 중...';
    refreshBtn.disabled = true;

    document.querySelectorAll('.status-dot').forEach(dot => {
        dot.style.animation = 'pulse-dot 1s ease-in-out infinite';
    });
}

function hideLoadingIndicator() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.classList.remove('loading');
    refreshBtn.textContent = '🔄 수동 새로고침';
    refreshBtn.disabled = false;

    document.querySelectorAll('.status-dot').forEach(dot => {
        dot.style.animation = 'pulse-dot 2s ease-in-out infinite';
    });
}

function showSuccessMessage(message) {
    console.log(`✅ ${message}`);

    const header = document.querySelector('.header-right');
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
        background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        margin-top: 8px;
        animation: fadeInOut 3s ease-in-out;
    `;
    successMsg.textContent = `✅ ${message}`;
    header.appendChild(successMsg);

    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-10px); }
            20%, 80% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        successMsg.remove();
        style.remove();
    }, 3000);
}

function showErrorMessage(message) {
    console.error(`❌ ${message}`);

    const header = document.querySelector('.header-right');
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = `
        background: linear-gradient(135deg, #d1242f 0%, #f85149 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        margin-top: 8px;
        animation: fadeInOut 4s ease-in-out;
    `;
    errorMsg.textContent = `❌ ${message}`;
    header.appendChild(errorMsg);

    setTimeout(() => {
        errorMsg.remove();
    }, 4000);
}

// Event listeners and other utility functions
function setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', updateRealTimeData);
    }
}

function startCountdownTimer() {
    // 수동 새로고침 전용: 카운트다운 대신 고정 메시지 표시
    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        countdownElement.textContent = '수동 새로고침 전용';
    }
    console.log('✅ 수동 새로고침 모드 - 자동 카운트다운 비활성화');
}

function updateDataValidationStatus() {
    // BTC 가격 데이터 검증
    const btcPriceElement = document.getElementById('validationBtcPrice');
    const btcStatusElement = document.getElementById('btcPriceStatus');

    if (appData.btc_price !== null) {
        btcPriceElement.textContent = `$${Math.round(appData.btc_price).toLocaleString()}`;
        btcStatusElement.className = 'validation-status connected';
    } else {
        btcPriceElement.textContent = '로딩 중...';
        btcStatusElement.className = 'validation-status loading';
    }

    // CSPI 지수 데이터 검증
    const cspiElement = document.getElementById('validationCSPI');
    const cspiStatusElement = document.getElementById('cspiStatus');

    if (appData.cspi_score !== null) {
        cspiElement.textContent = `${appData.cspi_score.toFixed(1)}/100`;
        cspiStatusElement.className = 'validation-status connected';
    } else {
        cspiElement.textContent = '로딩 중...';
        cspiStatusElement.className = 'validation-status loading';
    }

    // 개별 지표 데이터 검증
    const indicatorsElement = document.getElementById('validationIndicators');
    const indicatorsStatusElement = document.getElementById('indicatorsStatus');

    let connectedCount = 0;
    const indicators = [
        appData.mvrv_z_score,
        appData.altcoin_season_index,
        appData.kimchi_premium,
        appData.btc_dominance,
        appData.fear_greed_index,
        appData.rsi_14d
    ];

    indicators.forEach(indicator => {
        if (indicator !== null) connectedCount++;
    });

    if (connectedCount === 6) {
        indicatorsElement.textContent = '실시간 동기화';
        indicatorsStatusElement.className = 'validation-status connected';
        indicatorsStatusElement.querySelector('.api-source').textContent = '6개 지표 정상';
    } else if (connectedCount > 0) {
        indicatorsElement.textContent = `${connectedCount}/6 연결됨`;
        indicatorsStatusElement.className = 'validation-status partial';
        indicatorsStatusElement.querySelector('.api-source').textContent = `${connectedCount}개 지표 연결`;
    } else {
        indicatorsElement.textContent = '연결 중...';
        indicatorsStatusElement.className = 'validation-status loading';
        indicatorsStatusElement.querySelector('.api-source').textContent = '지표 로딩 중';
    }

    // 실시간 데이터 피드 상태
    const dataFeedElement = document.getElementById('validationDataFeed');
    const dataFeedStatusElement = document.getElementById('dataFeedStatus');

    if (connectedCount >= 4) {
        dataFeedElement.textContent = '연결됨';
        dataFeedStatusElement.className = 'validation-status connected';
    } else if (connectedCount > 0) {
        dataFeedElement.textContent = '부분 연결';
        dataFeedStatusElement.className = 'validation-status partial';
    } else {
        dataFeedElement.textContent = '연결 중...';
        dataFeedStatusElement.className = 'validation-status loading';
    }

    // 상태 점 색상 업데이트
    document.querySelectorAll('.validation-status.connected .status-dot').forEach(dot => {
        dot.style.backgroundColor = '#56d364'; // 녹색
    });
    document.querySelectorAll('.validation-status.partial .status-dot').forEach(dot => {
        dot.style.backgroundColor = '#d4951a'; // 주황색
    });
    document.querySelectorAll('.validation-status.loading .status-dot').forEach(dot => {
        dot.style.backgroundColor = '#8b949e'; // 회색
    });
}

// Export for global access
window.updateRealTimeData = updateRealTimeData;