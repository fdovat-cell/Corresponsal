import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { GetNearbyPlacesParams, GetPlaceBriefParams, GetPlaceNewsParams, HealthStatus, NearbyPlace, NewsItem, Place, PlaceBrief, SuggestPlacesParams } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSuggestPlacesUrl: (params: SuggestPlacesParams) => string;
/**
 * @summary Suggest places
 */
export declare const suggestPlaces: (params: SuggestPlacesParams, options?: Parameters<typeof customFetch>[1]) => Promise<Place[]>;
export declare const getSuggestPlacesQueryKey: (params?: SuggestPlacesParams) => readonly ["/api/places/suggest", ...SuggestPlacesParams[]];
export declare const getSuggestPlacesQueryOptions: <TData = Awaited<ReturnType<typeof suggestPlaces>>, TError = ErrorType<void>>(params: SuggestPlacesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof suggestPlaces>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof suggestPlaces>>, TError, TData> & {
    queryKey: QueryKey;
};
export type SuggestPlacesQueryResult = NonNullable<Awaited<ReturnType<typeof suggestPlaces>>>;
export type SuggestPlacesQueryError = ErrorType<void>;
/**
 * @summary Suggest places
 */
export declare function useSuggestPlaces<TData = Awaited<ReturnType<typeof suggestPlaces>>, TError = ErrorType<void>>(params: SuggestPlacesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof suggestPlaces>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPlaceBriefUrl: (params: GetPlaceBriefParams) => string;
/**
 * @summary Get a current brief for a place
 */
export declare const getPlaceBrief: (params: GetPlaceBriefParams, options?: Parameters<typeof customFetch>[1]) => Promise<PlaceBrief>;
export declare const getGetPlaceBriefQueryKey: (params?: GetPlaceBriefParams) => readonly ["/api/places/brief", ...GetPlaceBriefParams[]];
export declare const getGetPlaceBriefQueryOptions: <TData = Awaited<ReturnType<typeof getPlaceBrief>>, TError = ErrorType<unknown>>(params: GetPlaceBriefParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlaceBrief>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlaceBrief>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlaceBriefQueryResult = NonNullable<Awaited<ReturnType<typeof getPlaceBrief>>>;
export type GetPlaceBriefQueryError = ErrorType<unknown>;
/**
 * @summary Get a current brief for a place
 */
export declare function useGetPlaceBrief<TData = Awaited<ReturnType<typeof getPlaceBrief>>, TError = ErrorType<unknown>>(params: GetPlaceBriefParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlaceBrief>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPlaceNewsUrl: (params: GetPlaceNewsParams) => string;
/**
 * @summary Get current news for a place or topic
 */
export declare const getPlaceNews: (params: GetPlaceNewsParams, options?: Parameters<typeof customFetch>[1]) => Promise<NewsItem[]>;
export declare const getGetPlaceNewsQueryKey: (params?: GetPlaceNewsParams) => readonly ["/api/places/news", ...GetPlaceNewsParams[]];
export declare const getGetPlaceNewsQueryOptions: <TData = Awaited<ReturnType<typeof getPlaceNews>>, TError = ErrorType<unknown>>(params: GetPlaceNewsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlaceNews>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlaceNews>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlaceNewsQueryResult = NonNullable<Awaited<ReturnType<typeof getPlaceNews>>>;
export type GetPlaceNewsQueryError = ErrorType<unknown>;
/**
 * @summary Get current news for a place or topic
 */
export declare function useGetPlaceNews<TData = Awaited<ReturnType<typeof getPlaceNews>>, TError = ErrorType<unknown>>(params: GetPlaceNewsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlaceNews>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetNearbyPlacesUrl: (params: GetNearbyPlacesParams) => string;
/**
 * @summary Find nearby places
 */
export declare const getNearbyPlaces: (params: GetNearbyPlacesParams, options?: Parameters<typeof customFetch>[1]) => Promise<NearbyPlace[]>;
export declare const getGetNearbyPlacesQueryKey: (params?: GetNearbyPlacesParams) => readonly ["/api/places/nearby", ...GetNearbyPlacesParams[]];
export declare const getGetNearbyPlacesQueryOptions: <TData = Awaited<ReturnType<typeof getNearbyPlaces>>, TError = ErrorType<unknown>>(params: GetNearbyPlacesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNearbyPlaces>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getNearbyPlaces>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetNearbyPlacesQueryResult = NonNullable<Awaited<ReturnType<typeof getNearbyPlaces>>>;
export type GetNearbyPlacesQueryError = ErrorType<unknown>;
/**
 * @summary Find nearby places
 */
export declare function useGetNearbyPlaces<TData = Awaited<ReturnType<typeof getNearbyPlaces>>, TError = ErrorType<unknown>>(params: GetNearbyPlacesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNearbyPlaces>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map