import type { CommunityCategory, CommunityIdea } from "@/lib/contracts";

type FilterableCommunityIdea = Pick<
  CommunityIdea,
  "isPublic" | "category" | "votes" | "createdAt" | "title" | "discomfort" | "requestedFeature" | "targetUser"
> & { isMine: boolean };

export function filterCommunityIdeas<T extends FilterableCommunityIdea>(
  ideas: T[],
  options: { query?: string; category?: CommunityCategory | "all"; sort?: "recent" | "votes" },
) {
  const term = options.query?.trim().toLocaleLowerCase() || "";
  return ideas
    .filter((idea) => idea.isPublic || idea.isMine)
    .filter((idea) => !options.category || options.category === "all" || idea.category === options.category)
    .filter((idea) => !term || `${idea.title} ${idea.discomfort} ${idea.requestedFeature} ${idea.targetUser}`.toLocaleLowerCase().includes(term))
    .sort((left, right) => options.sort === "votes"
      ? right.votes - left.votes || right.createdAt.localeCompare(left.createdAt)
      : right.createdAt.localeCompare(left.createdAt));
}
