// ===================================
// 領収書アップロードコンポーネント
// ===================================
// カメラ or ギャラリーから画像選択 → プレビュー表示 → base64 変換

import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { fileToBase64 } from '../lib/api';

interface ReceiptUploaderProps {
  onImageReady: (base64: string, mimeType: string) => void;
  onImageClear: () => void;
}

export function ReceiptUploader({ onImageReady, onImageClear }: ReceiptUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ファイル選択時の処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);

    try {
      // 画像圧縮のオプション
      const options = {
        maxSizeMB: 1, // 最大1MB
        maxWidthOrHeight: 1280, // 最大幅・高さ
        useWebWorker: true,
      };

      // 圧縮処理を実行
      const compressedFile = await imageCompression(file, options);

      // プレビュー用 URL を生成（圧縮後の画像を使用）
      const objectUrl = URL.createObjectURL(compressedFile);
      setPreview(objectUrl);

      // base64 に変換して親コンポーネントに通知
      const base64 = await fileToBase64(compressedFile);
      onImageReady(base64, compressedFile.type);
    } catch (err) {
      console.error('画像の読み込みに失敗:', err);
    } finally {
      setProcessing(false);
    }
  };

  // 画像をクリア
  const handleClear = () => {
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onImageClear();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 画像プレビュー */}
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-matsuri-100 
          shadow-sm bg-white">
          <img
            src={preview}
            alt="領収書プレビュー"
            className="w-full max-h-48 object-contain bg-stone-50"
          />
          {/* 処理中のオーバーレイ */}
          {processing && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="bg-white rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
                <div className="spinner" />
                <span className="text-sm font-medium text-stone-700">読み込み中...</span>
              </div>
            </div>
          )}
          {/* クリアボタン */}
          {!processing && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 
                text-white flex items-center justify-center text-sm 
                hover:bg-black/70 transition-colors active:scale-90"
              aria-label="画像を削除"
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        /* 撮影/選択ボタン */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-6 rounded-2xl border-2 border-dashed border-matsuri-200 
            bg-gradient-to-b from-matsuri-50/50 to-white
            flex flex-col items-center gap-2 active:scale-[0.98] transition-transform"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium text-stone-500">
            タップして領収書を撮影
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
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="領収書画像を選択"
      />
    </div>
  );
}
