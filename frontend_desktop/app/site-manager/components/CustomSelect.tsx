"use client";

import React, { useState, useRef, useEffect } from "react";

export default function CustomSelect({ value, options, onChange, placeholder, disabled, icon, className, containerClassName }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o: any) => o.value === value);

  return (
    <div className={`relative w-full ${containerClassName || ""}`} ref={dropdownRef} style={{ zIndex: isOpen ? 100 : 1 }}>
      {icon && (
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[1.15rem] text-[#8fa88f] pointer-events-none transition-colors">
          {icon}
        </span>
      )}
      <div 
        className={`flex items-center w-full min-h-[48px] rounded-xl border border-[#dde5dd] dark:border-[#3b3b3b] bg-[#F5F7F5] dark:bg-[#1a1c19] text-[#1a1c19] dark:text-[#e2e3dd] text-sm font-bold cursor-pointer transition-all hover:border-[#b8c8b8] dark:hover:border-[#5c635a] hover:bg-white dark:hover:bg-[#232622] ${icon ? 'pl-12 pr-4' : 'px-4'} py-3 ${disabled ? 'opacity-60 cursor-not-allowed bg-[#eef2ee] dark:bg-[#141514]' : ''} ${className || ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
      >
        <span className={`flex-1 whitespace-nowrap overflow-hidden text-ellipsis ${!selectedOption ? 'text-[#a3b3a3] dark:text-[#707a6c] font-normal' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span 
          className="material-symbols-outlined text-[#8fa88f] text-[20px] transition-transform duration-200 ml-2" 
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
        >
          expand_more
        </span>
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-[#232622] rounded-[16px] border border-[#dde5dd] dark:border-[#3b3b3b] shadow-[0_12px_32px_rgba(0,0,0,0.1)] max-h-[240px] overflow-y-auto p-2 flex flex-col gap-[2px] z-[50]">
          {options.length === 0 && (
            <div className="py-3 px-4 text-[#6b7b6a] dark:text-[#a0a39f] text-[0.85rem] text-center">
              No options available
            </div>
          )}
          {options.map((opt: any) => (
            <div 
              key={opt.value}
              onClick={() => {
                onChange(opt.value, opt.label);
                setIsOpen(false);
              }}
              className="py-3 px-4 rounded-[10px] cursor-pointer text-[0.9rem] text-[#3d4a3c] dark:text-[#e2e3dd] transition-all hover:bg-[#f0f4f0] dark:hover:bg-white/5 hover:text-[#2E7D32] dark:hover:text-[#81C784] hover:font-bold"
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
