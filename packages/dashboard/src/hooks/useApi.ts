import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { AxiosRequestConfig, AxiosError } from 'axios';

interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  url: string,
  config?: AxiosRequestConfig,
  dependencies: unknown[] = []
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<T>(url, config);
      if (mountedRef.current) {
        setData(response.data);
      }
    } catch (err) {
      if (mountedRef.current) {
        const axiosError = err as AxiosError<{ message?: string }>;
        setError(
          axiosError.response?.data?.message ||
          axiosError.message ||
          'An error occurred'
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...dependencies]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

interface MutationState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  mutate: (body?: unknown) => Promise<T>;
  reset: () => void;
}

export function useMutation<T>(
  method: 'post' | 'put' | 'patch' | 'delete',
  url: string
): MutationState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: unknown): Promise<T> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api[method]<T>(url, body);
        setData(response.data);
        return response.data;
      } catch (err) {
        const axiosError = err as AxiosError<{ message?: string }>;
        const errorMsg =
          axiosError.response?.data?.message ||
          axiosError.message ||
          'An error occurred';
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [method, url]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, mutate, reset };
}
