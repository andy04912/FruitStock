/**
 * 數字格式化工具函數
 */

/**
 * 格式化金額（美元）
 * @param value - 金額
 * @param decimals - 小數位數，預設 2
 * @returns 格式化後的金額，例如：$1,234.56
 */
export const formatMoney = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }
  // Use simple implementation to avoid Worklet/Intl issues
  return '$' + value.toFixed(decimals).replace(/\d(?=(\d{3})+\.)/g, '$&,');
};

export const formatNumber = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return value.toFixed(decimals).replace(/\d(?=(\d{3})+\.)/g, '$&,');
};

export const formatPercent = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};

export const formatPrice = (value: number | null | undefined): string => {
  return formatMoney(value, 2);
};

/**
 * 格式化大數字（使用 K, M, B 等單位）
 * @param value - 數字
 * @returns 格式化後的數字，例如：1.23M
 */
export const formatCompactNumber = (value: number | null | undefined): string => {
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
 * @param value - 金額
 * @param threshold - 使用簡化格式的門檻，預設 1000000（百萬）
 * @returns 格式化後的金額
 *
 * 當絕對值 >= threshold 時使用 K/M/B 格式
 * 當絕對值 < threshold 時使用完整金額格式
 */
export const formatSmartMoney = (value: number | null | undefined, threshold = 1000000): string => {
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
