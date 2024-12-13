import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, Shield } from 'lucide-react';
import { getChecksumAddress } from 'starknet';

interface AgentRegistryModalProps {
  isOpen: boolean;
  onSubmit: (address: string) => boolean;
  error: string | null;
  onClose: () => void;
}

export const AgentRegistryModal: React.FC<AgentRegistryModalProps> = ({
  isOpen,
  onSubmit,
  error,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showChecksumWarning, setShowChecksumWarning] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit(inputValue)) {
      setInputValue('');
      setShowChecksumWarning(false);
    }
  };

  const handleChecksum = () => {
    try {
      const checksummed = getChecksumAddress(inputValue);
      setInputValue(checksummed);
      setShowChecksumWarning(true);
    } catch (e) {
      // If the address is invalid, the checksum function will throw
      // We don't need to do anything as the submit handler will catch this
    }
  };

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '90%',
    maxWidth: '500px',
    zIndex: 10000,
    backdropFilter: 'blur(4px)',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    cursor: 'pointer',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  };

  const warningStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.2)',
    borderRadius: '6px',
    marginBottom: '12px',
    color: 'rgb(234, 179, 8)',
    fontSize: '12px',
  };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ color: 'white', fontSize: '18px', margin: 0 }}>
            Enter Agent Registry Address
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowChecksumWarning(false);
            }}
            placeholder="0x..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              marginBottom: '8px',
            }}
          />
          
          <button
            type="button"
            onClick={handleChecksum}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 8px',
              marginBottom: '12px',
            }}
          >
            <Shield size={12} />
            Format as checksum address
          </button>
          
          {showChecksumWarning && (
            <div style={warningStyle}>
              <AlertTriangle size={14} />
              <span>Always verify addresses from trusted sources. Auto-checksumming can be unsafe.</span>
            </div>
          )}

          {error && (
            <p style={{ color: 'rgb(239, 68, 68)', marginBottom: '12px', fontSize: '14px' }}>
              {error}
            </p>
          )}
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default" size="sm">
              Submit
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}; 