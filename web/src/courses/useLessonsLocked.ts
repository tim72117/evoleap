import { useEffect, useState } from "react";
import { authApi } from "../auth/api";
import { useAuth } from "../auth/AuthContext";
import {
  levelIdOf,
  requiresSubscription,
  type Course,
} from "../content/catalog";

/**
 * 訂閱課程的單課要不要標「訂閱後觀看」:沒訂閱(含還在確認、查詢失敗)就標,章節大綱照常公開。
 * 不是訂閱課程一律不標。點進單課頁後由 SubscriptionGate 顯示訂閱畫面,真正的權限由後端把關。
 */
export function useLessonsLocked(course: Course | undefined): boolean {
  const { status, user } = useAuth();
  const subscriptionOnly = course ? requiresSubscription(course) : false;
  const levelId = course ? levelIdOf(course) : undefined;
  const userId = user?.id;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(false);
    if (!subscriptionOnly || !levelId || status === "loading" || !userId)
      return;
    let cancelled = false;
    authApi
      .courseAccess(levelId)
      .then((result) => {
        if (!cancelled) setAllowed(result.allowed);
      })
      .catch(() => {
        /* 確認不了就維持鎖住 */
      });
    return () => {
      cancelled = true;
    };
  }, [subscriptionOnly, levelId, status, userId]);

  return subscriptionOnly && !allowed;
}
