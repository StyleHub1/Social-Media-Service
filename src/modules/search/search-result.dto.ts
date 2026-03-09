import { Role } from '../common/enums/role.enum';

export class SearchResultDto {
  id: string;
  type: Role; // USER or BRAND
  username: string;
  firstName?: string;
  lastName?: string;
  brandName?: string;
  profileImageUrl?: string;
  score: number; // Relevance score from the search
}