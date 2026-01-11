import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

export const CandlestickChart = ({ data, colors = {}, fitTrigger = 0, viewMode = "history", onLoadMore }) => {
    const chartContainerRef = useRef();
    const chartInstance = useRef(null);
    const seriesInstance = useRef(null);
    const onLoadMoreRef = useRef(onLoadMore);

    useEffect(() => {
        onLoadMoreRef.current = onLoadMore;
    }, [onLoadMore]);

    const {
        backgroundColor = 'transparent',
        lineColor = '#2962FF',
        textColor = '#d1d5db',
        areaTopColor = '#2962FF',
        areaBottomColor = 'rgba(41, 98, 255, 0.28)',
        upColor = '#ef5350', // Red for up (Taiwan/Asia style)
        downColor = '#26a69a', // Green for down
    } = colors;
    useEffect(() => {
        if (!chartContainerRef.current) return;

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
            height: 400,
            grid: {
                vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
                horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: true,
                borderColor: 'rgba(197, 203, 206, 0.1)',
            },
            localization: {
                locale: 'zh-TW',
            },
            rightPriceScale: {
                 borderColor: 'rgba(197, 203, 206, 0.1)',
            }
        });
        
        const newSeries = chart.addSeries(CandlestickSeries, {
            upColor: upColor, 
            downColor: downColor,
            borderVisible: false, 
            wickUpColor: upColor,
            wickDownColor: downColor,
        });

        if (data && data.length > 0) {
            newSeries.setData(data);
        }

        chartInstance.current = chart;
        seriesInstance.current = newSeries;

        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(chartContainerRef.current);
        
        // --- SCROLL LISTENER ---
        const handleRangeChange = (newRange) => {
            if (newRange && newRange.from < 5 && onLoadMoreRef.current) {
                onLoadMoreRef.current();
            }
        };
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

        return () => {
            resizeObserver.disconnect();
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
            chart.remove();
        };
    }, [backgroundColor, textColor, upColor, downColor]); // Re-create if colors change

    // 1. Data Update Effect
    useEffect(() => {
        if (seriesInstance.current && data) {
             seriesInstance.current.setData(data);
        }
    }, [data]);

    const initialFitDone = useRef(false);

    // Reset initial fit flag when viewMode changes
    useEffect(() => {
        initialFitDone.current = false;
    }, [viewMode, fitTrigger]);

    // 2. View Mode / Range Effect
    // This runs on data update OR mode change, but only enforces range ONCE per mode switch.
    useEffect(() => {
        if (!chartInstance.current || !data || data.length === 0) return;

        if (!initialFitDone.current) {
            if (viewMode === "today") {
                 // Requirement: Load all data (already in `data`), but ZOOM into last 5 hours.
                 const lastTime = data[data.length - 1].time;
                 const fiveHoursSeconds = 5 * 60 * 60;
                 
                 chartInstance.current.timeScale().setVisibleRange({
                      from: lastTime - fiveHoursSeconds,
                      to: lastTime + 300 // 5 min future buffer
                 });
                 initialFitDone.current = true;
                 
            } else if (viewMode === "history" || fitTrigger > 0) {
                 chartInstance.current.timeScale().fitContent();
                 initialFitDone.current = true;
            }
        }
    }, [viewMode, fitTrigger, data]);

    return (
        <div 
            ref={chartContainerRef} 
            className="w-full h-[400px] relative"
        />
    );
};
