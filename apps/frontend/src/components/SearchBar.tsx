'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SearchBar() {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        placeholder="Search"
        className="pl-12 pr-6 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
      />
    </div>
  );
}