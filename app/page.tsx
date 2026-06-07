import StockApp from "./StockApp";

// Server component: reads the server-only env var and tells the client
// whether the backend is configured (without exposing the URL itself).
export default function Page() {
  const apiConfigured = Boolean(process.env.APPS_SCRIPT_URL);
  return <StockApp apiConfigured={apiConfigured} />;
}
