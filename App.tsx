import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Uploader } from './components/Uploader';
import { AnalysisView } from './components/AnalysisView';
import { initGenAI, processSingleFile, analyzeMoreOnPage } from './services/geminiService';
import { AppState, UploadedFile, AnalysisItem } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>([]);
  
  // Queue Management State
  const [processedCount, setProcessedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const aiRef = useRef(initGenAI());

  // Stats for Footer (Moved from Layout)
  const [onlineUsers, setOnlineUsers] = useState(27);
  const [totalVisits, setTotalVisits] = useState(15847);

  useEffect(() => {
    // Randomize slightly on mount
    setOnlineUsers(Math.floor(Math.random() * 20) + 15);
    setTotalVisits(prev => prev + Math.floor(Math.random() * 5));
  }, []);

  // Helper to sort items visually
  // Sort priority: Page -> Y Position -> X Position -> Problem ID
  const sortItems = (items: AnalysisItem[]) => {
    return items.sort((a, b) => {
        // 1. Sort by Page
        if (a.page !== b.page) return a.page - b.page;
        
        // 2. Sort by Vertical Position (ymin) if available
        if (a.boundingBox && b.boundingBox) {
            // Allow margin of error (e.g. 15 units out of 1000) for "same line" items
            const yDiff = a.boundingBox[0] - b.boundingBox[0];
            if (Math.abs(yDiff) > 15) return yDiff; // Clearly one is above the other
            
            // If vertically similar, sort left-to-right (xmin)
            return a.boundingBox[1] - b.boundingBox[1];
        }

        // 3. Fallback to problemId (legacy or manual items)
        return a.problemId - b.problemId;
    });
  };

  // Handle processing queue
  useEffect(() => {
    if (!isProcessing || isPaused || files.length === 0) return;

    if (processedCount >= files.length) {
        setIsProcessing(false);
        return;
    }

    const processNext = async () => {
        const fileIndex = processedCount;
        const file = files[fileIndex];
        
        try {
            const newItems = await processSingleFile(aiRef.current, file, fileIndex);
            
            setAnalysisItems(prev => {
                const updated = [...prev, ...newItems];
                return sortItems(updated);
            });

        } catch (error) {
            console.error("Batch processing error", error);
        } finally {
            setProcessedCount(prev => prev + 1);
        }
    };

    processNext();
  }, [isProcessing, isPaused, processedCount, files]);


  const handleFilesSelected = async (selectedFiles: UploadedFile[]) => {
    setFiles(selectedFiles);
    setProcessedCount(0);
    setAnalysisItems([]);
    setIsProcessing(true);
    setIsPaused(false);
    setState(AppState.RESULT); // Go directly to result view to show progress
  };

  const handleReset = () => {
    setFiles([]);
    setAnalysisItems([]);
    setProcessedCount(0);
    setIsProcessing(false);
    setIsPaused(false);
    setState(AppState.IDLE);
  };

  const handlePause = () => setIsPaused(true);
  const handleContinue = () => setIsPaused(false);

  // New Feature: Continue analysis for a specific page
  const handleContinuePageAnalysis = async (pageNumber: number) => {
    let fileToProcess: UploadedFile | undefined;
    let fileIndex = -1;

    // Handle PDF (1 file -> multiple pages) vs Images (1 file -> 1 page)
    if (files.length === 1 && files[0].mimeType === 'application/pdf') {
        fileToProcess = files[0];
        fileIndex = 0; // PDF is always at index 0
    } else {
        // Assume images 1-to-1 mapping
        fileIndex = pageNumber - 1;
        if (fileIndex >= 0 && fileIndex < files.length) {
            fileToProcess = files[fileIndex];
        }
    }

    if (!fileToProcess) return;

    // Filter items for this page to allow the AI to see context
    const existingItems = analysisItems.filter(i => i.page === pageNumber);

    try {
        const newItems = await analyzeMoreOnPage(aiRef.current, fileToProcess, fileIndex, existingItems, pageNumber);
        
        if (newItems.length > 0) {
             setAnalysisItems(prev => {
                const updated = [...prev, ...newItems];
                return sortItems(updated);
            });
            alert(`哆啦A夢又發現了 ${newItems.length} 個題目！`);
        } else {
            alert("哆啦A夢仔細檢查後，覺得這頁已經分析得很完整囉！");
        }
    } catch (e) {
        console.error(e);
        alert("分析過程中出了點小差錯，請再試一次");
    }
  };

  // Determine global progress
  const isComplete = files.length > 0 && processedCount === files.length;

  return (
    <Layout>
      {state === AppState.IDLE && (
        <div className="flex flex-col gap-4">
          
          {/* Top Header Section */}
          <div className="text-center mb-1">
            <h2 className="text-xl md:text-2xl text-blue-900 font-black tracking-tight">
              大雄...不，老師！遇到數學難題了嗎？
            </h2>
          </div>

          {/* Info & Resource Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-5xl mx-auto w-full px-1">
             
             {/* Left: Resource Links */}
             <div className="relative bg-sky-100 rounded-2xl border-4 border-[#5D4037] p-4 shadow-lg flex flex-col items-center justify-center text-center group hover:bg-sky-50 transition-colors">
                <div className="absolute -top-3 left-6 bg-[#039BE5] text-white font-bold px-3 py-1 rounded-full border-2 border-[#5D4037] shadow-md transform -rotate-2 text-xs">
                   資源連結
                </div>
                <p className="mt-2 text-slate-700 font-bold text-sm mb-2 leading-relaxed px-2">
                   若您想要尋找更多<span className="text-red-500">「數學教材資源」</span>，可以點選下方連結進入，先行下載備用：
                </p>
                <a 
                  href="https://padlet.com/cdrcdr/breakout-room/eo1R47MnMkMxqZDL-W7ZVbegpqEZ5XNDM" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-yellow-100 border-2 border-[#5D4037] text-slate-800 font-black py-2 px-6 rounded-xl shadow-[2px_2px_0px_0px_#5D4037] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center gap-2 text-base"
                >
                  <span className="text-lg">📚</span>
                  數學教學資源網
                </a>
             </div>

             {/* Right: Instructions */}
             <div className="relative bg-[#B2DFDB] rounded-2xl border-4 border-[#5D4037] p-4 shadow-lg flex flex-col items-center text-center group hover:bg-[#A7D7D3] transition-colors">
                <div className="absolute -top-3 right-6 bg-[#66BB6A] text-white font-bold px-3 py-1 rounded-full border-2 border-[#5D4037] shadow-md transform rotate-2 text-xs">
                   使用說明
                </div>
                
                {/* Header: Icon + Title on same line */}
                <div className="flex items-center justify-center gap-2 mb-2 mt-1">
                    <div className="text-2xl animate-bounce">💡</div>
                    <h3 className="text-lg font-black text-[#00695C]">不知道怎麼用？</h3>
                </div>

                <ul className="text-left text-slate-800 font-bold text-xs space-y-1 bg-white/50 p-3 rounded-lg w-full">
                  <li>1. 點擊下方<span className="text-red-500">「選擇檔案」</span>或<span className="text-yellow-600">「拍照」</span>。</li>
                  <li>2. 上傳您的數學課本、習作或考卷圖片。</li>
                  <li>3. 等待哆啦A夢幫您分析布題與重點。</li>
                  <li>4. 獲得包含<span className="text-green-600">「降階提問」</span>與<span className="text-indigo-600">「素養提問」</span>的備課指引！</li>
                </ul>
             </div>
          </div>

          {/* Main Operation Area Combined Section */}
          <div className="relative mt-6 mb-2">
             
             {/* Badge overlapping the box */}
             <div className="absolute left-0 right-0 -top-7 z-20 flex justify-center pointer-events-none">
                <div className="pointer-events-auto relative transform transition-transform hover:scale-105">
                  <div className="bg-gradient-to-b from-[#FF7043] to-[#E64A19] text-white text-lg md:text-xl font-black py-2 px-8 rounded-full border-[4px] border-[#5D4037] shadow-[0_4px_0_0_rgba(93,64,55,1),0_8px_10px_rgba(0,0,0,0.2)] flex items-center gap-3">
                      <span className="animate-bounce delay-100 text-yellow-300 text-2xl filter drop-shadow-lg">👇</span>
                      <span className="tracking-wider drop-shadow-md">主要操作區在此</span>
                      <span className="animate-bounce delay-100 text-yellow-300 text-2xl filter drop-shadow-lg">👇</span>
                      
                      {/* Shine effect */}
                      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full pointer-events-none"></div>
                  </div>
                </div>
             </div>

             {/* Uploader Section */}
             <div className="relative z-10 pt-4">
               <Uploader onFilesSelected={handleFilesSelected} />
             </div>
          </div>

          {/* Footer Info (Moved here, only shows on Homepage) */}
          <div className="mt-8 flex justify-center w-full">
            <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-full border-2 border-[#5D4037] px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 text-xs md:text-sm">
               
               {/* Email Section */}
               <div className="flex items-center gap-2 bg-yellow-50 px-4 py-1.5 rounded-full border border-yellow-200">
                  <span className="text-lg">✉️</span>
                  <span className="text-slate-700 font-bold">
                    問題反應信箱: <a href="mailto:qekepv@gmail.com" className="text-blue-600 hover:underline">qekepv@gmail.com</a>
                  </span>
               </div>

               {/* Stats Section */}
               <div className="flex items-center gap-4 text-slate-600 font-bold bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200">
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     <span>線上人數: <span className="text-red-500 text-base">{onlineUsers}</span> 人</span>
                  </div>
                  <div className="w-px h-3 bg-slate-300"></div>
                  <div className="flex items-center gap-2">
                     <span>👁️</span>
                     <span>累計人次: <span className="text-red-500 text-base">{totalVisits.toLocaleString()}</span> 人次</span>
                  </div>
               </div>

            </div>
          </div>

        </div>
      )}

      {/* RESULT View with Sequential Processing UI */}
      {state === AppState.RESULT && (
        <div className="relative min-h-screen">
            {/* Main Content */}
            <AnalysisView 
                analysisItems={analysisItems} 
                onReset={handleReset} 
                files={files} 
                onContinuePage={handleContinuePageAnalysis}
            />
            
            {/* Persistent Processing Control Panel (Sticky Bottom above footer) */}
            {!isComplete && (
                <div className="fixed bottom-20 left-0 w-full z-40 px-4 animate-fade-in-up">
                    <div className="max-w-3xl mx-auto bg-slate-800/90 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-slate-600 flex flex-row items-center justify-between gap-4">
                        
                        {/* Status Info */}
                        <div className="flex items-center pl-2">
                            <span className="font-bold text-yellow-400 text-lg flex items-center gap-2">
                                {isPaused ? "已暫停分析" : "哆啦A夢正在努力分析中..."}
                            </span>
                        </div>

                        {/* Controls */}
                        <div className="shrink-0">
                            {isPaused ? (
                                <button 
                                    onClick={handleContinue}
                                    className="bg-green-500 hover:bg-green-400 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                                >
                                    ▶ 繼續分析
                                </button>
                            ) : (
                                <button 
                                    onClick={handlePause}
                                    className="bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold py-2 px-6 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                                >
                                    ⏸ 暫停
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}
    </Layout>
  );
};

export default App;