import { Outlet, Links, Meta, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return <Outlet />;
}

export function Layout({ children }) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#f6f6f7" }}>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>MaddOptions Error</title>
      </head>
      <body style={{ fontFamily: "Arial, sans-serif", padding: "24px" }}>
        <h1>Root Error Boundary Triggered</h1>
        <Scripts />
      </body>
    </html>
  );
}