# Project Hub - dataSpring

## セットアップ

### 1. Google Sheets設定
`src/App.jsx` の先頭にある以下の2行を実際の値に差し替えてください：

```js
const SHEETS_CONFIG = {
  API_KEY: "ここにGCPのAPIキーを入力",
  SPREADSHEET_ID: "ここにSpreadsheetのIDを入力",
};
```

### 2. Spreadsheetの準備
Google Spreadsheetに以下の2つのシートを作成してください：
- `projects`
- `clients`

シートの共有設定を「リンクを知っている全員が編集可能」にしてください。

---

## ローカル開発

```bash
npm install
npm run dev
```

## Vercelへのデプロイ手順

1. このフォルダをGitHubリポジトリにpush
2. [vercel.com](https://vercel.com) にログイン（GitHubアカウントで可）
3. 「New Project」→ GitHubリポジトリを選択
4. 設定はデフォルトのままで「Deploy」
5. デプロイ完了後、発行されたURLをチームに共有

## コード更新時

`src/App.jsx` を編集してGitHubにpushすると、Vercelが自動で再デプロイします。
