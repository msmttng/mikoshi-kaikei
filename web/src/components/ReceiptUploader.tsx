// ===================================
// 領収書アップロードコンポーネント
// ===================================
// カメラ or ギャラリーから画像選択 → プレビュー表示 → base64 変換

import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { fileToBase64 } from '../lib/api';

interface ReceiptUploaderProps {
  onImagesReady: (images: {base64: string, mimeType: string, previewUrl: string}[]) => void;
}

export function ReceiptUploader({ onImagesReady }: ReceiptUploaderProps) {
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ファイル選択時の処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setProcessing(true);

    try {
      // 画像圧縮のオプション
      const options = {
        maxSizeMB: 1, // 最大1MB
        maxWidthOrHeight: 1280, // 最大幅・高さ
        useWebWorker: true,
      };

      const processedImages = [];
      for (const file of files) {
        // 圧縮処理を実行
        const compressedFile = await imageCompression(file, options);
        // プレビュー用 URL を生成（圧縮後の画像を使用）
        const objectUrl = URL.createObjectURL(compressedFile);
        // base64 に変換
        const base64 = await fileToBase64(compressedFile);
        
        processedImages.push({
          base64,
          mimeType: compressedFile.type,
          previewUrl: objectUrl
        });
      }

      // 親コンポーネントに配列を通知
      onImagesReady(processedImages);
    } catch (err) {
      console.error('画像の読み込みに失敗:', err);
    } finally {
      setProcessing(false);
      if (inputRef.current) {
        inputRef.current.value = ''; // 連続で同じファイルをアップロードできるようにリセット
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 処理中のオーバーレイ */}
      {processing && (
        <div className="relative rounded-2xl overflow-hidden border-2 border-matsuri-100 shadow-sm bg-white p-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="spinner" />
            <span className="text-sm font-medium text-stone-700">画像を処理中...</span>
          </div>
        </div>
      )}

      {/* 撮影/選択ボタン（処理中以外でプレビューが無い状態、プレビュー表示はSubmitForm側で制御） */}
      {!processing && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-6 rounded-2xl border-2 border-dashed border-matsuri-200 
            bg-gradient-to-b from-matsuri-50/50 to-white
            flex flex-col items-center gap-2 active:scale-[0.98] transition-transform"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium text-stone-500">
            タップして領収書を撮影（複数選択可）
          </span>
          <span className="text-xs text-stone-400">
            カメラまたはギャラリーから選択
          </span>
        </button>
      )}

      {/* 非表示のファイル入力 */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="領収書画像を選択"
      />
    </div>
  );
}
