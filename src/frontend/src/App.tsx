import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarX, Filter } from "lucide-react";
import { useMemo, useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const CENTRES: Record<number, string> = {
  693: "Mitchell Field",
  1463: "Edithvale",
  499: "Cummer",
  643: "Goulding",
  42: "Antibes",
};

// Age min/max in the data are in YEARS
const AGE_GROUPS = [
  { label: "Preschool (0–5 yrs)", minYears: 0, maxYears: 5 },
  { label: "Kids (6–12 yrs)", minYears: 6, maxYears: 12 },
  { label: "Youth (13–17 yrs)", minYears: 13, maxYears: 17 },
  { label: "Adult (18–64 yrs)", minYears: 18, maxYears: 64 },
  {
    label: "Senior (65+ yrs)",
    minYears: 65,
    maxYears: Number.POSITIVE_INFINITY,
  },
];

const DAYS_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const WEEK_OPTIONS: Array<{ value: "this" | "next" | "all"; label: string }> = [
  { value: "this", label: "This Week" },
  { value: "next", label: "Next Week" },
  { value: "all", label: "All" },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface RawEntry {
  locationId: number;
  locationName: string;
  courseTitle: string;
  ageMin: number;
  ageMax: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  firstDate: string;
  lastDate: string;
  dayOfWeek: string;
}

interface Session {
  locationId: number;
  centre: string;
  activity: string;
  ageMin: number;
  ageMax: number;
  date: string;
  day: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseData(entries: RawEntry[]): Session[] {
  return entries.map((r) => ({
    locationId: r.locationId,
    centre: CENTRES[r.locationId] ?? r.locationName,
    activity: r.courseTitle,
    ageMin: r.ageMin,
    ageMax: r.ageMax,
    date: r.firstDate,
    day: r.dayOfWeek,
    startHour: r.startHour,
    startMinute: r.startMinute,
    endHour: r.endHour,
    endMinute: r.endMinute,
  }));
}

function getWeekBounds(offset: number): { start: Date; end: Date } {
  const today = new Date();
  const dow = today.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function formatTime(h: number, m: number): string {
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatDate(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatAges(ageMin: number, ageMax: number): string {
  if (ageMin === 0 && ageMax >= 99) return "All Ages";
  if (ageMax >= 99) return `${ageMin}+ yrs`;
  return `${ageMin}–${ageMax} yrs`;
}

function ageGroupOverlaps(
  session: Session,
  group: (typeof AGE_GROUPS)[number],
): boolean {
  return session.ageMin <= group.maxYears && session.ageMax >= group.minYears;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [filterCentre, setFilterCentre] = useState("all");
  const [filterActivity, setFilterActivity] = useState("all");
  const [filterAgeGroup, setFilterAgeGroup] = useState("all");
  const [filterDay, setFilterDay] = useState("all");
  const [filterWeek, setFilterWeek] = useState<"this" | "next" | "all">("this");

  const {
    data: rawData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["dropInSports"],
    queryFn: async (): Promise<RawEntry[]> => {
      const res = await fetch("/dropin-data.json");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  const sessions = useMemo(
    () => (rawData ? parseData(rawData) : []),
    [rawData],
  );

  const activities = useMemo(() => {
    const set = new Set(sessions.map((s) => s.activity));
    return Array.from(set).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    let result = sessions;

    if (filterCentre !== "all") {
      result = result.filter((s) => String(s.locationId) === filterCentre);
    }
    if (filterActivity !== "all") {
      result = result.filter((s) => s.activity === filterActivity);
    }
    if (filterAgeGroup !== "all") {
      const group = AGE_GROUPS.find((g) => g.label === filterAgeGroup);
      if (group) result = result.filter((s) => ageGroupOverlaps(s, group));
    }
    if (filterDay !== "all") {
      result = result.filter((s) => s.day === filterDay);
    }
    if (filterWeek !== "all") {
      const offset = filterWeek === "this" ? 0 : 1;
      const { start, end } = getWeekBounds(offset);
      result = result.filter((s) => {
        const [y, mo, d] = s.date.split("-").map(Number);
        const sessionDate = new Date(y, mo - 1, d);
        return sessionDate >= start && sessionDate <= end;
      });
    }

    result = [...result].sort((a, b) => {
      const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.startHour !== b.startHour
        ? a.startHour - b.startHour
        : a.startMinute - b.startMinute;
    });

    return result;
  }, [
    sessions,
    filterCentre,
    filterActivity,
    filterAgeGroup,
    filterDay,
    filterWeek,
  ]);

  const clearFilters = () => {
    setFilterCentre("all");
    setFilterActivity("all");
    setFilterAgeGroup("all");
    setFilterDay("all");
    setFilterWeek("this");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "oklch(var(--background))" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 bg-card border-b border-border"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-base tracking-tight text-foreground">
            North York Drop-In Sports
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <h1 className="text-3xl font-bold text-center text-foreground mb-8 tracking-tight">
          North York Drop-In Sports Schedule
        </h1>

        {/* Card */}
        <div
          className="bg-card rounded-xl border border-border"
          style={{ boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}
        >
          {/* Filters */}
          <div className="p-5 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              {/* Community Centre */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Community Centre
                </p>
                <Select value={filterCentre} onValueChange={setFilterCentre}>
                  <SelectTrigger
                    className="w-full bg-card border-border"
                    data-ocid="centre.select"
                  >
                    <SelectValue placeholder="All Centres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Centres</SelectItem>
                    {Object.entries(CENTRES).map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Activity */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Activity
                </p>
                <Select
                  value={filterActivity}
                  onValueChange={setFilterActivity}
                >
                  <SelectTrigger
                    className="w-full bg-card border-border"
                    data-ocid="activity.select"
                  >
                    <SelectValue placeholder="All Activities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activities</SelectItem>
                    {activities.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Age Group */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Age Group
                </p>
                <Select
                  value={filterAgeGroup}
                  onValueChange={setFilterAgeGroup}
                >
                  <SelectTrigger
                    className="w-full bg-card border-border"
                    data-ocid="agegroup.select"
                  >
                    <SelectValue placeholder="All Ages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ages</SelectItem>
                    {AGE_GROUPS.map((g) => (
                      <SelectItem key={g.label} value={g.label}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Day */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Day of Week
                </p>
                <Select value={filterDay} onValueChange={setFilterDay}>
                  <SelectTrigger
                    className="w-full bg-card border-border"
                    data-ocid="day.select"
                  >
                    <SelectValue placeholder="All Days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Days</SelectItem>
                    {DAYS_ORDER.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Week */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Week
                </p>
                <div className="flex rounded-md border border-border overflow-hidden h-10">
                  {WEEK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-ocid="week.toggle"
                      onClick={() => setFilterWeek(opt.value)}
                      className={`flex-1 text-xs font-medium transition-colors ${
                        filterWeek === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action row */}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
                data-ocid="filters.secondary_button"
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:opacity-90"
                data-ocid="filters.primary_button"
              >
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                Filter Results
              </Button>
            </div>
          </div>

          {/* Results count */}
          <div className="px-5 py-3 flex items-center justify-between border-b border-border">
            <span className="text-sm text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                `Showing ${filtered.length} session${filtered.length !== 1 ? "s" : ""}`
              )}
            </span>
          </div>

          {/* Table area */}
          {isLoading ? (
            <div className="p-6 space-y-3" data-ocid="schedule.loading_state">
              {Array.from({ length: 8 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div
              className="p-12 flex flex-col items-center gap-4 text-center"
              data-ocid="schedule.error_state"
            >
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-foreground font-medium">
                Failed to load schedule data
              </p>
              <p className="text-muted-foreground text-sm">
                There was a problem loading the drop-in sports data.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="p-12 flex flex-col items-center gap-3 text-center"
              data-ocid="schedule.empty_state"
            >
              <CalendarX className="w-10 h-10 text-muted-foreground" />
              <p className="text-foreground font-medium">No sessions found</p>
              <p className="text-muted-foreground text-sm">
                Try adjusting your filters or selecting a different week.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-ocid="schedule.table">
                <TableHeader>
                  <TableRow
                    style={{ backgroundColor: "oklch(var(--table-header))" }}
                  >
                    <TableHead className="font-semibold text-foreground text-sm">
                      Community Centre
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">
                      Activity
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">
                      Day
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">
                      Date
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">
                      Time
                    </TableHead>
                    <TableHead className="font-semibold text-foreground text-sm">
                      Ages
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => (
                    <TableRow
                      key={`${s.locationId}-${s.activity}-${s.date}-${s.startHour}-${s.startMinute}`}
                      data-ocid={`schedule.item.${i + 1}`}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="font-medium text-foreground py-3">
                        {s.centre}
                      </TableCell>
                      <TableCell className="text-foreground py-3">
                        {s.activity}
                      </TableCell>
                      <TableCell className="text-foreground py-3">
                        {s.day}
                      </TableCell>
                      <TableCell className="text-foreground py-3 whitespace-nowrap">
                        {formatDate(s.date)}
                      </TableCell>
                      <TableCell className="text-foreground py-3 whitespace-nowrap">
                        {formatTime(s.startHour, s.startMinute)} –{" "}
                        {formatTime(s.endHour, s.endMinute)}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-3 whitespace-nowrap">
                        {formatAges(s.ageMin, s.ageMax)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Card footer */}
          <div className="px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Data downloaded from City of Toronto Open Data · Last refreshed
              March 19, 2026
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-card">
        © {new Date().getFullYear()}. Built with ❤️ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-primary transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
