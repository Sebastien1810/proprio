'use client';

const TYPE_COLOR = {
  buy:      '#00FFC8',
  rent:     '#FF2D78',
  build:    '#A855F7',
  alliance: '#00B4FF',
  strike:   '#FF6B2B',
  night:    '#FFE600',
  warn:     '#FF3B3B',
  info:     'rgba(255,255,255,0.3)',
  event:    '#F59E0B',
};

export default function ToastLog({ toasts }) {
  const visible = toasts.slice(-3);

  return (
    <div
      className="fixed bottom-28 left-4 z-50 flex flex-col gap-2 pointer-events-none"
      data-testid="toast-log"
    >
      {visible.map(toast => (
        <div
          key={toast.id}
          className="px-4 py-2.5 rounded-xl text-sm text-white max-w-xs shadow-2xl backdrop-blur-sm animate-[slideUp_0.3s_ease-out]"
          style={{
            background:  '#22222e',
            borderLeft:  `3px solid ${TYPE_COLOR[toast.type] ?? TYPE_COLOR.info}`,
            border:      `1px solid rgba(255,255,255,0.06)`,
            borderLeftColor: TYPE_COLOR[toast.type] ?? TYPE_COLOR.info,
            borderLeftWidth: '3px',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
