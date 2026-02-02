/**
 * 數字格式化工具函數
 */

/**
 * 格式化金額（美元）
 * @param {number} value - 金額
 * @param {number} decimals - 小數位數，預設 2
 * @returns {string} - 格式化後的金額，例如：$1,234.56
 */
export const formatMoney = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
};

/**
 * 格式化數字（帶千位分隔符）
 * @param {number} value - 數字
 * @param {number} decimals - 小數位數，預設 0
 * @returns {string} - 格式化後的數字，例如：1,234
 */
export const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined || isNaN(value)) {
        return '0';
    }
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
};

/**
 * 格式化百分比
 * @param {number} value - 數值（0.05 表示 5%）
 * @param {number} decimals - 小數位數，預設 2
 * @returns {string} - 格式化後的百分比，例如：+5.23%
 */
export const formatPercent = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
        return '0.00%';
    }
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
};

/**
 * 格式化價格（股價）
 * @param {number} value - 價格
 * @returns {string} - 格式化後的價格，例如：$1,234.56
 */
export const formatPrice = (value) => {
    return formatMoney(value, 2);
};

/**
 * 格式化大數字（使用 K, M, B 等單位）
 * @param {number} value - 數字
 * @returns {string} - 格式化後的數字，例如：1.23M
 */
export const formatCompactNumber = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
        return '0';
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1e9) {
        return `${sign}${(absValue / 1e9).toFixed(2)}B`;
    } else if (absValue >= 1e6) {
        return `${sign}${(absValue / 1e6).toFixed(2)}M`;
    } else if (absValue >= 1e3) {
        return `${sign}${(absValue / 1e3).toFixed(2)}K`;
    }
    return formatNumber(value, 2);
};

/**
 * 智能金額格式化（根據數字大小自動選擇格式）
 * @param {number} value - 金額
 * @param {number} threshold - 使用簡化格式的門檻，預設 1000000（百萬）
 * @returns {string} - 格式化後的金額
 * 
 * 當絕對值 >= threshold 時使用 K/M/B 格式
 * 當絕對值 < threshold 時使用完整金額格式
 */
export const formatSmartMoney = (value, threshold = 1000000) => {
    if (value === null || value === undefined || isNaN(value)) {
        return '$0.00';
    }
    
    const absValue = Math.abs(value);
    
    if (absValue >= threshold) {
        const sign = value < 0 ? '-' : '';
        return `${sign}$${formatCompactNumber(absValue)}`;
    }
    
    return formatMoney(value);
};
