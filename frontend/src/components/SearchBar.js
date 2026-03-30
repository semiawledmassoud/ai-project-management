import React from 'react';

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5C6490', fontSize: 14 }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Rechercher...'}
        style={{
          width: '100%', background: '#1A1D28',
          border: '1px solid #252A3D', borderRadius: 8,
          padding: '9px 12px 9px 36px',
          color: '#E8EAF6', fontSize: 13, outline: 'none'
        }}
      />
    </div>
  );
}