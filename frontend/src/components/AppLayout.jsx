import AppRail from './AppRail';

// `pb-24` clears the fixed mobile tab bar.
export default function AppLayout({ background = 'bg-bg', children }) {
  return (
    <div className={`min-h-screen flex flex-col sm:flex-row ${background}`}>
      <AppRail />
      <div className="flex-1 min-w-0 flex flex-col pb-24 sm:pb-0">{children}</div>
    </div>
  );
}
