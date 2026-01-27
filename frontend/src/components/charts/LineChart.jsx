import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';

export const LineChart = ({
    data,
    height = 300,
    colors = {},
    showLegend = false,
    series = ['total_assets'] // 預設顯示總資產
}) => {
    const chartContainerRef = useRef();
    const chartInstance = useRef(null);
    const seriesInstances = useRef({});

    const {
        backgroundColor = 'transparent',
        textColor = '#d1d5db',
        gridColor = 'rgba(197, 203, 206, 0.1)',
        // 台灣市場顏色標準：紅漲綠跌
        totalAssetsColor = '#06b6d4', // cyan
        cashColor = '#10b981', // emerald
        stockValueColor = '#f59e0b', // amber
    } = colors;

    const seriesConfig = {
        total_assets: {
            label: '總資產',
            color: totalAssetsColor,
            lineWidth: 3,
        },
        cash: {
            label: '現金',
            color: cashColor,
            lineWidth: 2,
        },
        stock_value: {
            label: '股票市值',
            color: stockValueColor,
            lineWidth: 2,
        }
    };

    useEffect(() => {
        if (!chartContainerRef.current || !data || data.length === 0) return;

        const handleResize = () => {
            if (chartInstance.current && chartContainerRef.current) {
                chartInstance.current.applyOptions({
                    width: chartContainerRef.current.clientWidth
                });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            grid: {
                vertLines: { color: gridColor },
                horzLines: { color: gridColor },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: gridColor,
            },
            localization: {
                locale: 'zh-TW',
                dateFormat: 'yyyy/MM/dd',
                priceFormatter: (price) => {
                    // 格式化 Y 軸數值，加上千位分隔符
                    return new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(price);
                },
            },
            rightPriceScale: {
                borderColor: gridColor,
            },
        });

        chartInstance.current = chart;

        // 添加每個系列
        series.forEach(seriesKey => {
            if (!seriesConfig[seriesKey]) return;

            const config = seriesConfig[seriesKey];
            const lineSeries = chart.addSeries(LineSeries, {
                color: config.color,
                lineWidth: config.lineWidth,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                lastValueVisible: true,
                priceLineVisible: false,
            });

            // 轉換數據格式：從 {date: "2024-01-01", total_assets: 10000}
            // 轉換為 [{time: "2024-01-01", value: 10000}]
            const seriesData = data.map(d => ({
                time: d.date.split('T')[0], // 確保格式為 YYYY-MM-DD
                value: d[seriesKey] || 0
            })).filter(d => d.value !== undefined);

            if (seriesData.length > 0) {
                lineSeries.setData(seriesData);
            }

            seriesInstances.current[seriesKey] = lineSeries;
        });

        // 自動調整視圖範圍
        chart.timeScale().fitContent();

        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, [data, backgroundColor, textColor, gridColor, height, series]);

    // 更新數據
    useEffect(() => {
        if (!data || data.length === 0) return;

        series.forEach(seriesKey => {
            const lineSeries = seriesInstances.current[seriesKey];
            if (lineSeries) {
                const seriesData = data.map(d => ({
                    time: d.date.split('T')[0],
                    value: d[seriesKey] || 0
                })).filter(d => d.value !== undefined);

                if (seriesData.length > 0) {
                    lineSeries.setData(seriesData);
                }
            }
        });

        if (chartInstance.current) {
            chartInstance.current.timeScale().fitContent();
        }
    }, [data, series]);

    return (
        <div className="w-full">
            <div
                ref={chartContainerRef}
                className="w-full relative"
                style={{ height: `${height}px` }}
            />

            {/* 圖例 */}
            {showLegend && (
                <div className="flex flex-wrap gap-4 mt-3 justify-center">
                    {series.map(seriesKey => {
                        const config = seriesConfig[seriesKey];
                        if (!config) return null;

                        return (
                            <div key={seriesKey} className="flex items-center gap-2">
                                <div
                                    className="w-4 h-1 rounded-full"
                                    style={{ backgroundColor: config.color }}
                                />
                                <span className="text-sm text-zinc-400">
                                    {config.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
