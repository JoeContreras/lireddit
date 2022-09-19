import DataLoader from "dataloader";
import { In } from "typeorm";
import { Updoot } from "../entities/Updoot";

//check voteStatus in batches
// [{postId: 5, userId: 10}, {postId: 10, userId: 10}, {postId: 6, userId: 1}]
// [{postId: 5, value: 1}, {postId: 10, value: -1}, {postId: 6, value: 1}]
// {5: 1, 10: -1, 6: 1}
export const createUpdootLoader = () => {
  return new DataLoader<{ postId: number; userId: number }, Updoot | null>(
    async (keys) => {
      const updoots = await Updoot.findBy({
        postId: In(keys.map((key) => key.postId)),
        userId: In(keys.map((key) => key.userId)),
      });
      const updootIdsToUpdoot: Record<string, Updoot> = {};
      updoots.forEach((u) => {
        updootIdsToUpdoot[`${u.userId}|${u.postId}`] = u;
      });
      return keys.map(
        (key) => updootIdsToUpdoot[`${key.userId}|${key.postId}`]
      );
    }
  );
};
