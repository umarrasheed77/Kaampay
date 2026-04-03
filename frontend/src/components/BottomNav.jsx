import React from 'react';

const navItems = [
  { id: '1', label: 'Home', icon: '🏠' },
  { id: '3', label: 'History', icon: '📝' },
  { id: '4', label: 'FAB', isFab: true, icon: '🎙' },
  { id: '6', label: 'Workers', icon: '👥' },
  { id: '7', label: 'Settings', icon: '⚙️' }
];

export default function BottomNav({ currentScreen, onNavigate }) {
  return (
    <div className="bottom-nav">
      {navItems.map((item, idx) => {
        if (item.isFab) {
          return (
            <div key="fab" className="bottom-nav-item" onClick={() => onNavigate('2')}>
              <div className="mic-fab">{item.icon}</div>
              <span style={{opacity: 0}}>{item.label}</span>
            </div>
          );
        }

        const isActive = currentScreen === item.id;
        return (
          <div 
            key={item.id} 
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
