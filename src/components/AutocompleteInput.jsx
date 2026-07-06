import React, { useState, useRef, useEffect } from 'react';

export default function AutocompleteInput({
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  multiline = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Filter suggestions based on current input
  const filteredSuggestions = suggestions.filter(s =>
    s && s.toLowerCase().includes((value || '').toLowerCase())
  ).slice(0, 8); // Max 8 suggestions

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          e.preventDefault();
          selectSuggestion(filteredSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const selectSuggestion = (suggestion) => {
    onChange(suggestion);
    setIsOpen(false);
    setHighlightedIndex(-1);
    // Keep focus on input for editing
    inputRef.current?.focus();
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div ref={containerRef} className="relative">
      <InputComponent
        ref={inputRef}
        type={multiline ? undefined : 'text'}
        rows={multiline ? 2 : undefined}
        value={value || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${className} ${multiline ? 'resize-none' : ''}`}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`px-3 py-2 cursor-pointer text-sm truncate ${
                index === highlightedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before click
                selectSuggestion(suggestion);
              }}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
