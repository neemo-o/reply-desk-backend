import { apiClient } from "./api-client";
import type { User } from "@/types/auth";

export interface UpdateUserPayload {
  name?: string;
  avatar?: string;
}

export const usersService = {
  async me(): Promise<User> {
    const { data } = await apiClient.get<User>("/users/me");
    return data;
  },

  async updateMe(payload: UpdateUserPayload): Promise<User> {
    const { data } = await apiClient.patch<User>("/users/me", payload);
    return data;
  },
};
