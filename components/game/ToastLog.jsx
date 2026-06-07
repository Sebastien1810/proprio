'use client';

import { useEffect, useRef, useState } from 'react';

export default function ToastLog({ toasts }) {
  // toasts : [{ id, message, type }]
  // type: 'info' | 'buy' | 'rent' | 'build' | 'alliance' | 'strike' | 'night' | 'warn'

  const TYPE_STYLE = {
    buy:      'bg-blue-900/90 border-blue-500/50',
    rent:     'bg-red-900/90 border-red-500/50',
    build:    'bg-green-900/90 border-green-500/50',
    alliance: 'bg-purple-900/90 border-purple-500/50',
    strike:   'bg-orange-900/90 border-orange-500/50',
    night:    'bg-indigo-900/90 border-indigo-500/50',
    warn:     'bg-yellow-900/90 border-yellow-500/50',
    info:     'bg-gray-800/90 border-white/20',
  };

  const visible = toasts.slice(-4);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" data-testid="toast-log">
      {visible.map(toast => (
        <div
          key={toast.id}
          className={`
            px-4 py-2.5 rounded-xl border text-sm text-white max-w-xs
            shadow-2xl backdrop-blur-sm
            animate-[slideInRight_0.3s_ease-out]
            ${TYPE_STYLE[toast.type] ?? TYPE_STYLE.info}
          `}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
