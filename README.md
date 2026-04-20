# 神輿会 経費精算アプリ (mikoshi-kaikei)

神輿会の経費精算をスマホで完結させる PWA アプリ。

## 概要

- **提出者（6名）**: スマホから支出/収入を登録
- **管理者（1名）**: 精算状況を管理
- **データ保存**: Google Sheets（台帳）+ Google Drive（領収書画像）
- **通知**: Gmail で管理者に自動通知

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | React + TypeScript + Vite + Tailwind CSS v4 |
| ホスティング | GitHub Pages |
| バックエンド | Google Apps Script (Web App) |
| OCR | Gemini 2.5 Flash（Phase 2 で実装） |
| データベース | Google Sheets |
| ファイル保存 | Google Drive |
| 通知 | Gmail |

## セットアップ

### 1. Google Sheets の作成

1. Google Sheets で新しいスプレッドシートを作成
2. 以下の3つのシートを作成:

#### `台帳` シート（1行目にヘッダー）

| A | B | C | D | E | F | G | H | I | J | K | L | M | N |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ID | 登録日時 | 種別 | 日付 | 提出者 | 事業区分 | 金額 | 但し書き | 支払先 | 領収書URL | 支払状況 | 精算日 | 備考 | OCR信頼度 |

#### `設定` シート

| A列 | B列 |
|---|---|
| 提出者リスト | 山田太郎 |
| | 田中花子 |
| | 佐藤一郎 |
| | 鈴木二郎 |
| | 高橋三郎 |
| | 渡辺四郎 |
| 事業区分リスト | 例大祭 |
| | 神輿渡御 |
| | 直会・懇親 |
| | 備品・装束 |
| | 町会関連 |
| | 通常運営 |
| | 寄付・協賛 |
| | 会費 |
| | その他 |
| 管理者メール | admin@example.com |

#### `月次集計` シート

`QUERY` や `SUMIFS` 関数で自動集計（手動で数式を設定）。

### 2. GAS Web App のデプロイ

1. Google Sheets のメニュー → `拡張機能` → `Apps Script`
2. `gas/` フォルダ内の各 `.js` ファイルの内容を GAS エディタにコピー
3. `プロジェクトの設定` → スクリプト プロパティに以下を追加:
   - `ADMIN_KEY`: 管理者画面のアクセスキー（任意の文字列）
   - `GEMINI_API_KEY`: Gemini API キー（Phase 2 で使用）
4. `デプロイ` → `新しいデプロイ` → `ウェブアプリ`
   - 「次のユーザーとして実行」: **自分**
   - 「アクセスできるユーザー」: **全員**
5. デプロイ URL をコピー

### 3. フロントエンドの設定

```bash
cd web
cp .env.example .env
# .env の VITE_GAS_URL にデプロイ URL を設定
npm install
npm run dev
```

### 4. GitHub Pages へのデプロイ

```bash
cd web
npm run build
# dist/ フォルダの内容をリポジトリの docs/ にコピー
# GitHub Settings → Pages → Source: docs/
```

## 開発コマンド

```bash
cd web
npm run dev    # 開発サーバー起動
npm run build  # 本番ビルド
```

## ディレクトリ構成

```
mikoshi-kaikei/
├── web/                  # PWA フロントエンド
│   ├── src/
│   │   ├── pages/        # 画面コンポーネント
│   │   ├── components/   # 共通コンポーネント
│   │   ├── lib/          # API通信・ストレージ
│   │   ├── App.tsx       # ルーティング
│   │   └── index.css     # Tailwind + カスタムスタイル
│   ├── public/icons/     # PWA アイコン
│   └── vite.config.ts
├── gas/                  # GAS バックエンド
│   ├── Code.js           # API ルーター
│   ├── Submit.js         # 登録処理
│   ├── Notify.js         # Gmail 通知
│   ├── Admin.js          # 管理者機能
│   └── Ocr.js            # Gemini OCR（Phase 2）
├── docs/
│   └── setup.md          # セットアップ手順
└── README.md
```

## 実装フェーズ

- [x] **Phase 1**: 支出/収入登録 + GAS バックエンド + Gmail 通知
- [x] **Phase 2**: Gemini OCR 統合
- [x] **Phase 3**: 管理者画面強化 + 提出者自動返信
- [x] **Phase 4**: 月次集計グラフ + 画像圧縮
- [x] **Phase 5**: マスターデータ管理（但し書き・支払先）+ オートコンプリート
