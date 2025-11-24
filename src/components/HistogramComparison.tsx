import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface HistogramComparisonProps {
  originalImageSrc: string | null;
  modifiedImageSrc: string | null;
}

interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
}

// Helper to compute histogram from an image source
const computeHistogram = (src: string): Promise<HistogramData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      const r = new Array(256).fill(0);
      const g = new Array(256).fill(0);
      const b = new Array(256).fill(0);

      for (let i = 0; i < data.length; i += 4) {
        r[data[i]]++;
        g[data[i + 1]]++;
        b[data[i + 2]]++;
      }
      resolve({ r, g, b });
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

const HistogramComparison = ({
  originalImageSrc,
  modifiedImageSrc,
}: HistogramComparisonProps) => {
  const [originalHist, setOriginalHist] = useState<HistogramData | null>(null);
  const [modifiedHist, setModifiedHist] = useState<HistogramData | null>(null);
  const [channel, setChannel] = useState<'rgb' | 'r' | 'g' | 'b'>('rgb');
  const [viewMode, setViewMode] = useState<'overlay' | 'difference'>('overlay');

  useEffect(() => {
    if (originalImageSrc) {
      computeHistogram(originalImageSrc).then(setOriginalHist).catch(console.error);
    }
  }, [originalImageSrc]);

  useEffect(() => {
    if (modifiedImageSrc) {
      computeHistogram(modifiedImageSrc).then(setModifiedHist).catch(console.error);
    }
  }, [modifiedImageSrc]);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 0; i < 256; i++) {
      const item: any = { intensity: i };
      
      if (originalHist && modifiedHist) {
          // Overlay Mode Data
          if (viewMode === 'overlay') {
              if (channel === 'rgb' || channel === 'r') {
                  item.rOriginal = originalHist.r[i];
                  item.rModified = modifiedHist.r[i];
              }
              if (channel === 'rgb' || channel === 'g') {
                  item.gOriginal = originalHist.g[i];
                  item.gModified = modifiedHist.g[i];
              }
              if (channel === 'rgb' || channel === 'b') {
                  item.bOriginal = originalHist.b[i];
                  item.bModified = modifiedHist.b[i];
              }
          } 
          // Difference Mode Data
          else {
              if (channel === 'rgb' || channel === 'r') {
                  item.rDiff = modifiedHist.r[i] - originalHist.r[i];
              }
              if (channel === 'rgb' || channel === 'g') {
                  item.gDiff = modifiedHist.g[i] - originalHist.g[i];
              }
              if (channel === 'rgb' || channel === 'b') {
                  item.bDiff = modifiedHist.b[i] - originalHist.b[i];
              }
          }
      }
      data.push(item);
    }
    return data;
  }, [originalHist, modifiedHist, channel, viewMode]);

  if (!originalImageSrc && !modifiedImageSrc) return null;

  const renderOverlayChart = () => (
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="intensity" type="number" domain={[0, 255]} tickCount={10} />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
            <Legend />

            {/* Red Channel */}
            {(channel === 'rgb' || channel === 'r') && (
                <>
                    <Area type="monotone" dataKey="rOriginal" stackId="r" stroke="transparent" fill="rgba(255, 0, 0, 0.2)" name="Red (Original)" />
                    <Line type="monotone" dataKey="rOriginal" stroke="rgba(255, 0, 0, 0.5)" dot={false} strokeWidth={2} name="Red (Original)" />
                    <Line type="monotone" dataKey="rModified" stroke="rgba(180, 0, 0, 1)" dot={false} strokeWidth={2} strokeDasharray="5 5" name="Red (Modified)" />
                </>
            )}

            {/* Green Channel */}
            {(channel === 'rgb' || channel === 'g') && (
                <>
                     <Area type="monotone" dataKey="gOriginal" stackId="g" stroke="transparent" fill="rgba(0, 255, 0, 0.2)" name="Green (Original)" />
                     <Line type="monotone" dataKey="gOriginal" stroke="rgba(0, 255, 0, 0.5)" dot={false} strokeWidth={2} name="Green (Original)" />
                     <Line type="monotone" dataKey="gModified" stroke="rgba(0, 150, 0, 1)" dot={false} strokeWidth={2} strokeDasharray="5 5" name="Green (Modified)" />
                </>
            )}

            {/* Blue Channel */}
            {(channel === 'rgb' || channel === 'b') && (
                <>
                    <Area type="monotone" dataKey="bOriginal" stackId="b" stroke="transparent" fill="rgba(0, 0, 255, 0.2)" name="Blue (Original)" />
                    <Line type="monotone" dataKey="bOriginal" stroke="rgba(0, 0, 255, 0.5)" dot={false} strokeWidth={2} name="Blue (Original)" />
                    <Line type="monotone" dataKey="bModified" stroke="rgba(0, 0, 180, 1)" dot={false} strokeWidth={2} strokeDasharray="5 5" name="Blue (Modified)" />
                </>
            )}
        </AreaChart>
      </ResponsiveContainer>
  );

  const renderDifferenceChart = () => (
    <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="intensity" type="number" domain={[0, 255]} tickCount={10} />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
            <Legend />
            <Line dataKey="zero" stroke="#000" strokeWidth={1} dot={false} />

            {(channel === 'rgb' || channel === 'r') && (
                <Line type="monotone" dataKey="rDiff" stroke="#ef4444" dot={false} strokeWidth={2} name="Red Diff" />
            )}
            {(channel === 'rgb' || channel === 'g') && (
                <Line type="monotone" dataKey="gDiff" stroke="#22c55e" dot={false} strokeWidth={2} name="Green Diff" />
            )}
            {(channel === 'rgb' || channel === 'b') && (
                <Line type="monotone" dataKey="bDiff" stroke="#3b82f6" dot={false} strokeWidth={2} name="Blue Diff" />
            )}
        </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="mt-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-xl font-bold text-gray-800">Histogram Analysis</h3>
        
        <div className="flex flex-wrap gap-3">
            <div className="bg-gray-100 p-1 rounded-lg flex text-sm">
                <button 
                    onClick={() => setChannel('rgb')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${channel === 'rgb' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    RGB
                </button>
                <button 
                    onClick={() => setChannel('r')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${channel === 'r' ? 'bg-white text-red-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Red
                </button>
                <button 
                    onClick={() => setChannel('g')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${channel === 'g' ? 'bg-white text-green-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Green
                </button>
                <button 
                    onClick={() => setChannel('b')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${channel === 'b' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Blue
                </button>
            </div>

            <div className="bg-gray-100 p-1 rounded-lg flex text-sm">
                <button 
                    onClick={() => setViewMode('overlay')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'overlay' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Overlay
                </button>
                <button 
                    onClick={() => setViewMode('difference')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'difference' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Difference
                </button>
            </div>
        </div>
      </div>

      <div className="w-full" style={{ minHeight: '400px' }}>
        {viewMode === 'overlay' ? renderOverlayChart() : renderDifferenceChart()}
      </div>
      
      <div className="mt-4 text-sm text-gray-500 text-center">
         {viewMode === 'overlay' ? (
             <p>Comparing pixel intensity distribution. <span className="font-medium">Solid lines</span> are original, <span className="font-medium underline decoration-dashed">dashed lines</span> are modified.</p>
         ) : (
             <p>Showing the exact difference in pixel counts (Modified - Original) at each intensity level.</p>
         )}
      </div>
    </div>
  );
};

export default HistogramComparison;
