import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { messages } from "../i18n/current";
import { useT } from "../i18n/I18nProvider";
import { SiteLayout } from "../site/SiteLayout";
import { ACCESS_LABEL } from "../content/levels";
import { coursePath, courseMapId, nextCourse, type Course } from "../content/catalog";
import { useCourseMap } from "../content/courseMap";
import { useAuth } from "../auth/AuthContext";
import { COURSE_LIST, topicOfCourse } from "../content/topics";
import { lazyPage } from "../site/lazyPage";
import { LevelArt } from "../home/LevelArt";
import {
  CLOCK,
  Icon,
  LessonGroup,
  LessonGroups,
  LessonListStatus,
  PLAY,
} from "./LessonGroup";
import {
  artOf,
  lessonLink,
  overviewGroups,
  rowLabel,
  rowLink,
  startLesson,
} from "./overviewModel";
import styles from "./CourseOverview.module.css";
import { safeDecodeURIComponent } from "../site/safeDecode";

// 課程總覽:上方是課程介紹(標籤、標題、簡述、總時長與課數)與開始學習的卡片,下方是課程內容清單。
// 所有內容都從資料庫讀(GET /api/courses/{id}/map):標題、簡介、說明段落、插圖、簡介影片、單元與每一課(課號、名稱、一句話、時間、開放與否、要不要登入);
// 讀取中顯示佔位卡、讀不到顯示「無法讀取」,不用前端寫死的課程資料頂替。只有一條畫法(版面邏輯在 overviewModel.ts):每個單元一組、每個單元有 #stage-<單元 id> 的錨點。
// 搜尋標題與描述由 server 讀同一個資料庫組出來(server/cmd/server/courseseo.go)。
// 清單每一列:播放圖示、課名(還沒開放的課標「🌱 規劃中」)、一句話、形式(有腳本的是互動)與時長。
// 未登入時,開放的課在右側標「預覽」或鎖頭(登入後學習);確認登入狀態前不標,已登入的人不會閃過標籤。

/** 「約 15 分」「約 1 小時 20 分」→ 分鐘;看不懂的回傳 0 */
export function minutesOf(length: string): number {
  const h = /(\d+)\s*小時/.exec(length);
  const m = /(\d+)\s*分/.exec(length);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

/** 總時長(目前語言):「約 45 分鐘」「約 1 小時 20 分」 */
export function formatMinutes(total: number): string {
  const t = messages().courses;
  if (total < 60) return t.aboutMinutes(total);
  return t.aboutHours(Math.floor(total / 60), total % 60);
}

// 課程簡介影片:小播放器用到時才下載(和 Claude Code 工作術的情境影片一樣)
const LivePlayer = lazyPage(() =>
  import("./LivePlayer").then((m) => m.LivePlayer),
);

const BOOK =
  "M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5zM12 6v13.5";

export function CourseOverviewPage({ course }: { course: Course }) {
  const t = useT();
  const c = t.courses;
  const next = nextCourse(course);
  const topic = topicOfCourse(coursePath(course));
  const mapState = useCourseMap(courseMapId(course));
  const ready = mapState.status === "ready";
  const map = mapState.status === "ready" ? mapState.map : undefined;
  // 主題名稱:API 依語言回傳的(英文版是翻譯);還沒讀到時先用前端內建的
  const topicName = map?.topic || topic.name;
  // 主題就是這門課自己(網頁怎麼運作):麵包屑接全部課程,不連回自己
  const crumb =
    topic.path === coursePath(course)
      ? { name: t.site.nav.courses, to: COURSE_LIST.path }
      : { name: topicName, to: `${topic.path}#map` };
  const groups = map ? overviewGroups(map) : [];
  const lessons = groups.flatMap((g) => g.lessons);
  const total = lessons.reduce((n, l) => n + (l.minutes ?? 0), 0);
  const guest = useAuth().status === "guest";
  const hash = useLocation().hash;
  useEffect(() => {
    // 單元要等課程地圖讀到才有,讀到後再捲到 #stage-…
    if (!ready || !hash) return;
    document
      .getElementById(safeDecodeURIComponent(hash.slice(1)))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ready, hash]);
  const start = startLesson(course.slug, groups, guest);
  const startTo = start && lessonLink(course.slug, start);
  const labels = (map?.units ?? [])
    .filter((u) => !u.hidden && u.label)
    .map((u) => c.levelName(u.label!))
    .join("・");
  const access = map ? ACCESS_LABEL[map.access] : null;
  // 讀到之前先用路由的課名,免得標題空一下
  const title = map ? map.title : course.title;

  return (
    <SiteLayout title={map ? map.seoTitle || map.title : course.title}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.intro}>
            <nav className={styles.crumb} aria-label={c.breadcrumb}>
              <Link to={crumb.to}>{crumb.name}</Link>
              <span aria-hidden="true">/</span>
              <span>{title}</span>
            </nav>
            <p className={styles.tags}>
              {labels && <span className={styles.tagStrong}>{labels}</span>}
              {access && (
                <span className={styles.tag}>{c.accessName(access)}</span>
              )}
              {topicName !== title && (
                <span className={styles.tag}>{topicName}</span>
              )}
            </p>
            <h1>{title}</h1>
            {map?.summary && <p className={styles.lead}>{map.summary}</p>}
            <p className={styles.meta}>
              {total > 0 && (
                <span>
                  <Icon d={CLOCK} size={22} />
                  {formatMinutes(total)}
                </span>
              )}
              {ready && (
                <span>
                  <Icon d={BOOK} size={22} />
                  {c.lessonCount(lessons.length)}
                </span>
              )}
            </p>
          </div>
          <aside className={styles.card}>
            {map && (
              <div className={styles.art}>
                <LevelArt art={artOf(map)} />
              </div>
            )}
            {startTo && (
              <Link className={styles.start} to={startTo}>
                <Icon d={PLAY} />
                {c.overview.start}
              </Link>
            )}
          </aside>
        </div>
      </section>

      {map?.introScript && (
        <section className={styles.block} aria-labelledby="course-intro">
          <h2 id="course-intro">{c.overview.intro}</h2>
          <div className={styles.introPlayer}>
            <LivePlayer
              script={map.introScript}
              title={c.overview.intro}
              onTime={() => {}}
              saveProgress={false}
            />
          </div>
        </section>
      )}

      {map && map.about && map.about.length > 0 && (
        <section className={styles.block} aria-labelledby="course-about">
          <h2 id="course-about">{c.overview.about}</h2>
          <div className={styles.about}>
            {map.about.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
      )}

      <section
        className={styles.content}
        id="map"
        aria-labelledby="course-content"
      >
        <h2 id="course-content">{c.overview.content}</h2>
        {map ? (
          <LessonGroups>
            {groups.map((g) => (
              <LessonGroup
                key={g.id}
                id={g.anchor}
                title={g.title}
                subtitle={g.subtitle}
                lessons={g.lessons}
                pathOf={(l) => rowLink(course, g, l, g.lessons.indexOf(l))}
                labelOf={(l) => rowLabel(course, g, l, g.lessons.indexOf(l))}
                guest={guest}
              />
            ))}
          </LessonGroups>
        ) : (
          <LessonListStatus state={mapState.status as "loading" | "error"} />
        )}
        {next && (
          <Link className={styles.nextCourse} to={coursePath(next)}>
            <small>{c.nextCourse}</small>
            <span>
              {c.levelName(next.level)} · {next.title}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>
    </SiteLayout>
  );
}
