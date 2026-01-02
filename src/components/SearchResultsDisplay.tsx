'use client';

import { useState } from 'react';
import { SearchResult } from '@/types';

interface SearchResultsDisplayProps {
  results: SearchResult[];
}

export function SearchResultsDisplay({ results }: SearchResultsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (results.length === 0) return null;

  return (
    <div className="ml-10 md:ml-13 mb-2 md:mb-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-cyan-500 hover:text-cyan-300 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Web検索結果を{isExpanded ? '折りたたむ' : '展開'}</span>
        <span className="text-xs text-gray-500">({results.length}件)</span>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-cyan-700/50 space-y-2 max-h-48 md:max-h-64 overflow-y-auto">
          {results.map((result, index) => (
            <div
              key={`${result.url}-${index}`}
              className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-2 md:p-3"
            >
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-medium text-sm md:text-base line-clamp-1"
              >
                {result.title}
              </a>
              <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                {result.content}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {result.engine && (
                  <span className="bg-gray-700/50 px-1.5 py-0.5 rounded">
                    {result.engine}
                  </span>
                )}
                {result.publishedDate && (
                  <span>{result.publishedDate}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
