import { useState, useEffect, useCallback } from 'react';
import { get_encoding, encoding_for_model, TiktokenModel } from 'tiktoken';
import { useDebouncedCallback } from 'use-debounce';

export const useTokenCount = (model: TiktokenModel = 'gpt-4') => {
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [encoder, setEncoder] = useState<ReturnType<typeof encoding_for_model> | null>(null);
  const [lastText, setLastText] = useState('');

  // Initialize encoder
  useEffect(() => {
    const enc = encoding_for_model(model);
    setEncoder(enc);
    
    return () => {
      // Cleanup encoder on unmount or model change
      if (enc) {
        enc.free();
      }
    };
  }, [model]);

  // Debounced token counting function
  const debouncedCount = useDebouncedCallback(
    (text: string) => {
      if (!encoder || !text) {
        setTokenCount(0);
        setIsDebouncing(false);
        return;
      }

      try {
        const tokens = encoder.encode(text);
        setTokenCount(tokens.length);
      } catch (error) {
        console.warn('Error counting tokens:', error);
        setTokenCount(0);
      } finally {
        setIsDebouncing(false);
      }
    },
    500 // Wait 500ms after the user stops typing
  );

  // Wrapper function to handle immediate state updates
  const countTokens = useCallback((text: string) => {
    setLastText(text);
    setIsDebouncing(text !== lastText);
    debouncedCount(text);
  }, [debouncedCount, lastText]);

  return {
    tokenCount,
    countTokens,
    isDebouncing,
  };
}; 