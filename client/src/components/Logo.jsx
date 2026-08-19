export function Logo({ withWordmark = true, size = 32 }) {
  return (
    <span className="logo">
      <span className="logo-mark" style={{ width: size, height: size }}>PH</span>
      {withWordmark && <span className="logo-wordmark">PluginHive</span>}
    </span>
  );
}
