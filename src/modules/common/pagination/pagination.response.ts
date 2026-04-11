export interface PaginationResponse<T> {
  items: T[];
  meta:{
    total: number;
    limit: number;
    offset: number;
    };
}