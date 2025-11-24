import { useEffect, useMemo, useState } from 'react';
import { StegEncoder, type EncodeStats, DEFAULT_TOTAL_POINTERS, DEFAULT_POINTER_ALIASES } from './steg/StegEncoder';
import { StegDecoder } from './steg/StegDecoder';
import HistogramComparison from './components/HistogramComparison';
import { Utf8 } from 'crypto-es';

function App() {
  const [activeTab, setActiveTab] = useState<'encode' | 'decode'>('encode');
  
  // Encode State
  const [encodeFile, setEncodeFile] = useState<File | null>(null);
  const [encodeFileUrl, setEncodeFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (encodeFile) {
      const url = URL.createObjectURL(encodeFile);
      setEncodeFileUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setEncodeFileUrl(null);
    }
  }, [encodeFile]);

  const [encodeMessage, setEncodeMessage] = useState('');
  const [encodeResult, setEncodeResult] = useState<{ key: string; imageUrl: string; stats: EncodeStats } | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [encodeProgress, setEncodeProgress] = useState<number>(0);
  const [encodePhase, setEncodePhase] = useState<string>('');
  const [encodeDebug, setEncodeDebug] = useState(false);

  // Alias Count (auto-optimized) State
  const [aliasAuto, setAliasAuto] = useState(true);
  const [overheadPct, setOverheadPct] = useState(10); // "wiggle room" percentage above message length
  const [aliasCount, setAliasCount] = useState<number>(DEFAULT_POINTER_ALIASES);

  const computeRecommendedAliasCount = (msgLen: number, overhead: number) => {
    if (msgLen <= 0) return DEFAULT_POINTER_ALIASES;
    const desiredEncodablePixels = Math.max(1, Math.ceil(msgLen * (1 + overhead / 100)));
    let alias = Math.floor(DEFAULT_TOTAL_POINTERS / desiredEncodablePixels);
    if (!Number.isFinite(alias) || alias < 1) alias = 1;
    if (alias > DEFAULT_TOTAL_POINTERS) alias = DEFAULT_TOTAL_POINTERS;
    return alias;
  };

  const recommendedAlias = useMemo(
    () => computeRecommendedAliasCount(encodeMessage.length, overheadPct),
    [encodeMessage.length, overheadPct]
  );
  const encodingPixelsCount = useMemo(
    () => Math.floor(DEFAULT_TOTAL_POINTERS / Math.max(1, aliasAuto ? recommendedAlias : aliasCount)),
    [aliasAuto, recommendedAlias, aliasCount]
  );

  useEffect(() => {
    if (aliasAuto) {
      setAliasCount(recommendedAlias);
    }
  }, [aliasAuto, recommendedAlias]);

  // Decode State
  const [decodeFile, setDecodeFile] = useState<File | null>(null);
  const [decodeKey, setDecodeKey] = useState('');
  const [decodeResult, setDecodeResult] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decodeDebug, setDecodeDebug] = useState(false);

  const handleEncode = async () => {
    if (!encodeFile || !encodeMessage) return;
    setIsEncoding(true);
    setEncodeError(null);
    setEncodeResult(null);
    setEncodeProgress(0);
    setEncodePhase('Starting...');

    try {
      const effectiveAlias = aliasAuto ? recommendedAlias : aliasCount;
      const encoder = new StegEncoder(encodeFile, encodeMessage, effectiveAlias, encodeDebug);
      const result = await encoder.encode(async (p, phase) => {
        setEncodeProgress(p || 0);
        if (phase) setEncodePhase(phase);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      });
      
      // Create blob from result.image (Uint8Array) without using 'any'
      const ab = new ArrayBuffer(result.image.byteLength);
      new Uint8Array(ab).set(result.image);
      const blob = new Blob([ab], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      
      setEncodeResult({
        key: result.key,
        imageUrl: url,
        stats: result.stats
      });
    } catch (e: unknown) {
      console.error(e);
      setEncodeError(e instanceof Error ? e.message : 'An error occurred during encoding.');
    } finally {
      setIsEncoding(false);
      setEncodePhase('');
      setEncodeProgress(0);
    }
  };

  const handleDecode = async () => {
    if (!decodeFile || !decodeKey) return;
    setIsDecoding(true);
    setDecodeError(null);
    setDecodeResult(null);

    try {
      const decoder = new StegDecoder(decodeFile, decodeKey, decodeDebug);
      const result = await decoder.decode();
      // result is WordArray, convert to utf8 string
      const plaintext = result.toString(Utf8);
      
      if (!plaintext) {
          setDecodeResult("Success, but resulted in empty text (or decoding failed silently).");
      } else {
          setDecodeResult(plaintext);
      }
    } catch (e: unknown) {
      console.error(e);
      setDecodeError(e instanceof Error ? e.message : 'An error occurred during decoding.');
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <header className="bg-blue-600 text-white p-6 shadow-md">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold">SecureSteg Dashboard</h1>
          <p className="opacity-90 mt-1">Hide messages in images securely.</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex mb-6 border-b border-gray-300">
          <button
            className={`px-6 py-3 font-semibold text-lg transition-colors ${
              activeTab === 'encode'
                ? 'border-b-4 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('encode')}
          >
            Encode
          </button>
          <button
            className={`px-6 py-3 font-semibold text-lg transition-colors ${
              activeTab === 'decode'
                ? 'border-b-4 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('decode')}
          >
            Decode
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {activeTab === 'encode' ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Encode Left: Inputs */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-700 mb-4">1. Select Image & Message</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source Image</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => setEncodeFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                  {encodeFile && encodeFileUrl && (
                    <div className="mt-4 p-2 border rounded bg-gray-50">
                        <p className="text-xs text-gray-500 mb-1">Preview:</p>
                        <img 
                            src={encodeFileUrl} 
                            alt="Preview" 
                            className="max-h-48 object-contain mx-auto"
                        />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Secret Message</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={5}
                    placeholder="Enter your secret message here..."
                    value={encodeMessage}
                    onChange={(e) => setEncodeMessage(e.target.value)}
                  />
                </div>

                {/* AliasCount Optimization */}
                <div className="p-4 border rounded bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Encoding Settings</h3>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={aliasAuto}
                        onChange={(e) => setAliasAuto(e.target.checked)}
                      />
                      Auto optimize alias count
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Overhead (%) {aliasAuto ? '(applies to auto)' : ''}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={5}
                          value={overheadPct}
                          onChange={(e) => setOverheadPct(parseInt(e.target.value, 10))}
                          className="flex-1"
                        />
                        <span className="w-12 text-right text-sm text-gray-700">{overheadPct}%</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Alias Count</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={DEFAULT_TOTAL_POINTERS}
                          value={aliasAuto ? recommendedAlias : aliasCount}
                          onChange={(e) => setAliasCount(Math.max(1, Math.min(DEFAULT_TOTAL_POINTERS, parseInt(e.target.value || '1', 10))))}
                          disabled={aliasAuto}
                          className="w-32 border border-gray-300 rounded-md p-2 bg-white text-sm"
                        />
                        {aliasAuto ? (
                          <span className="text-xs text-gray-500">auto</span>
                        ) : (
                          <span className="text-xs text-gray-500">manual</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={encodeDebug}
                          onChange={(e) => setEncodeDebug(e.target.checked)}
                        />
                        Debug logs
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="p-2 rounded border bg-white">
                      <div className="text-gray-500">Message Length</div>
                      <div className="font-semibold">{encodeMessage.length.toLocaleString()} bytes</div>
                    </div>
                    <div className="p-2 rounded border bg-white">
                      <div className="text-gray-500">Effective Alias</div>
                      <div className="font-semibold">{(aliasAuto ? recommendedAlias : aliasCount).toLocaleString()}</div>
                    </div>
                    <div className="p-2 rounded border bg-white">
                      <div className="text-gray-500">Encoding Pixels</div>
                      <div className="font-semibold">{encodingPixelsCount.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {(isEncoding || encodePhase) && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{encodePhase || 'Encoding...'}</span>
                      <span>{Math.round((encodeProgress || 0) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${Math.round((encodeProgress || 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleEncode}
                  disabled={!encodeFile || !encodeMessage || isEncoding}
                  className={`w-full py-3 px-4 rounded-md text-white font-bold text-lg transition-colors ${
                    !encodeFile || !encodeMessage || isEncoding
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                  }`}
                >
                  {isEncoding ? 'Encoding...' : 'Encrypt & Hide Message'}
                </button>
                
                {encodeError && (
                    <div className="p-4 bg-red-100 text-red-700 rounded-md border border-red-200">
                        Error: {encodeError}
                    </div>
                )}
              </div>

              {/* Encode Right: Results */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-700 mb-4">2. Result</h2>
                
                {!encodeResult ? (
                  <div className="h-full flex items-center justify-center text-gray-400 italic">
                    Results will appear here after encoding.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                        <h3 className="text-green-800 font-bold mb-2">Success!</h3>
                        <p className="text-green-700 text-sm">Message encoded successfully.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Decryption Key (SAVE THIS)</label>
                      <div className="flex">
                        <input 
                            readOnly 
                            value={encodeResult.key} 
                            className="flex-1 border border-gray-300 rounded-l-md p-2 bg-white text-sm font-mono text-gray-600"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button 
                            onClick={() => navigator.clipboard.writeText(encodeResult.key)}
                            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-r-md text-sm font-medium text-gray-700 border border-l-0 border-gray-300"
                        >
                            Copy
                        </button>
                      </div>
                      <p className="text-xs text-red-500 mt-1">You will need this key to decode the message later.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Encoded Image</label>
                        <div className="border rounded bg-white p-2 mb-4">
                            <img src={encodeResult.imageUrl} alt="Encoded" className="max-h-64 object-contain mx-auto" />
                        </div>
                        <a 
                            href={encodeResult.imageUrl} 
                            download="steg-encoded.png"
                            className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md shadow"
                        >
                            Download Image
                        </a>
                    </div>
                    
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Encoding Statistics</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded border bg-white">
                          <div className="text-sm text-gray-500">Pixels in Image</div>
                          <div className="text-xl font-bold">{encodeResult.stats.pixelsTotal.toLocaleString()}</div>
                        </div>
                        <div className="p-4 rounded border bg-white">
                          <div className="text-sm text-gray-500">Pixels Encoded</div>
                          <div className="text-xl font-bold">{encodeResult.stats.pixelsEncoded.toLocaleString()}</div>
                        </div>
                        <div className="p-4 rounded border bg-white">
                          <div className="text-sm text-gray-500">Pixels Modified</div>
                          <div className="text-xl font-bold">
                            {encodeResult.stats.pixelsModified.toLocaleString()}
                            <span className="text-sm text-gray-500 ml-2">
                              ({encodeResult.stats.percentPixelsModified.toFixed(4)}%)
                            </span>
                          </div>
                        </div>
                        <div className="p-4 rounded border bg-white">
                          <div className="text-sm text-gray-500">Bytes Modified</div>
                          <div className="text-xl font-bold">{encodeResult.stats.bytesModified.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                    
                  </div>
                )}
              </div>
            </div>
            {encodeResult && encodeFileUrl && (
              <div className="mt-8">
                <HistogramComparison
                  originalImageSrc={encodeFileUrl}
                  modifiedImageSrc={encodeResult.imageUrl}
                />
              </div>
            )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Decode Left: Inputs */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-700 mb-4">1. Select Image & Key</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Encoded Image</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => setDecodeFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                   {decodeFile && (
                    <div className="mt-4 p-2 border rounded bg-gray-50">
                        <p className="text-xs text-gray-500 mb-1">Preview:</p>
                        <img 
                            src={URL.createObjectURL(decodeFile)} 
                            alt="Preview" 
                            className="max-h-48 object-contain mx-auto"
                            onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                        />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Decryption Key</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Paste the key here..."
                    value={decodeKey}
                    onChange={(e) => setDecodeKey(e.target.value)}
                  />
                </div>

                <div className="flex items-center">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={decodeDebug}
                      onChange={(e) => setDecodeDebug(e.target.checked)}
                    />
                    Debug logs
                  </label>
                </div>

                <button
                  onClick={handleDecode}
                  disabled={!decodeFile || !decodeKey || isDecoding}
                  className={`w-full py-3 px-4 rounded-md text-white font-bold text-lg transition-colors ${
                    !decodeFile || !decodeKey || isDecoding
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                  }`}
                >
                  {isDecoding ? 'Decoding...' : 'Decode Message'}
                </button>

                 {decodeError && (
                    <div className="p-4 bg-red-100 text-red-700 rounded-md border border-red-200">
                        Error: {decodeError}
                    </div>
                )}
              </div>

              {/* Decode Right: Results */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-700 mb-4">2. Result</h2>
                
                {!decodeResult ? (
                  <div className="h-full flex items-center justify-center text-gray-400 italic">
                    Decoded message will appear here.
                  </div>
                ) : (
                  <div className="space-y-4">
                     <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                        <h3 className="text-green-800 font-bold mb-2">Message Recovered!</h3>
                        <div className="p-4 bg-white rounded border border-gray-200 font-mono text-gray-800 break-words whitespace-pre-wrap">
                            {decodeResult}
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
