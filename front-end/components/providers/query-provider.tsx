"use client"

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { Toaster } from "@/components/ui/sonner"
import { ApiError, errorMessage } from "@/lib/api/errors"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}

function retryOnce(failureCount: number, error: unknown): boolean {
  const transient =
    error instanceof ApiError && (error.status === 0 || error.status >= 500)
  return transient && failureCount < 1
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (mutation.meta?.silent) return
        toast.error(errorMessage(error))
      },
    }),
    defaultOptions: {
      queries: { retry: retryOnce, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}
