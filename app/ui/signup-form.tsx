'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { lusitana } from '@/app/ui/fonts';
import { AtSymbolIcon, KeyIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { Button } from '@/app/ui/button';
import { signup } from '@/app/lib/actions';

export default function SignupForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsPending(true);

    // Create FormData object from the form
    const formData = new FormData(event.currentTarget);

    // Debug: Check if formData is properly formed
    console.log('Form Data:', formData);

    const response = await signup(formData);

    setIsPending(false);

    if (response.error) {
      setErrorMessage(response.error);
    } else {
      // Redirect to the login page upon successful signup
      router.push('/login');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-4 pt-8">
        <h1 className={`${lusitana.className} mb-3 text-2xl`}>Create an account</h1>
        <div className="w-full">
          <div>
            <label className="mb-3 mt-5 block text-xs font-medium text-gray-900" htmlFor="name">
              Name
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                id="name"
                type="text"
                name="name"
                placeholder="Enter your full name"
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-3 mt-5 block text-xs font-medium text-gray-900" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
              />
              <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-3 mt-5 block text-xs font-medium text-gray-900" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                id="password"
                type="password"
                name="password"
                placeholder="Enter password"
                required
                minLength={6}
              />
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
          </div>
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={isPending}>
          {isPending ? 'Signing up...' : 'Sign up'}
        </Button>
        {errorMessage && (
          <div className="mt-4 text-red-500">{errorMessage}</div>
        )}
      </div>
    </form>
  );
}
