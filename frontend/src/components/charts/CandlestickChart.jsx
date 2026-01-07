import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

export const CandlestickChart = ({ data, colors = {} }) => {
    const chartContainerRef = useRef();
    const chartInstance = useRef(null);
    const seriesInstance = useRef(null);

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
        
        // Add Candlestick Series (v5 API)
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

        // Use ResizeObserver instead of window resize for better container responsiveness
        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, [backgroundColor, textColor, upColor, downColor]); // Re-create if colors change, but data updates separately

    // Update data effect
    useEffect(() => {
        if (seriesInstance.current && data) {
             seriesInstance.current.setData(data);
             // chartInstance.current.timeScale().fitContent(); // Optional: Auto fit
        }
    }, [data]);

    return (
        <div 
            ref={chartContainerRef} 
            className="w-full h-[400px] relative"
        />
    );
};
