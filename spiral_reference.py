import json, numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.animation import FuncAnimation, FFMpegWriter

data = json.load(open("gistemp.json"))
years  = np.array([d["y"] for d in data])
months = np.array([d["m"] for d in data])
vals   = np.array([d["v"] for d in data])
N = len(data)

# polar coordinates: Jan at top, clockwise
theta = (months - 1) / 12.0 * 2*np.pi
r     = vals

# time-colored spectrum (cold/old -> hot/recent)
cmap = LinearSegmentedColormap.from_list("spiral", [
    "#3a0f6b", "#243a9e", "#1f7fb8", "#1fa98a",
    "#9bc63b", "#f1c12a", "#ef7a22", "#d61f1f", "#7a0000"])
norm = Normalize(vmin=years.min(), vmax=years.max())
seg_colors = cmap(norm(years[1:]))

RMIN, RMAX = -1.05, 2.25

fig = plt.figure(figsize=(10.24, 10.24), dpi=100)
fig.patch.set_facecolor("#000000")
ax = fig.add_subplot(111, projection="polar")
ax.set_facecolor("#000000")
ax.set_theta_zero_location("N")
ax.set_theta_direction(-1)
ax.set_ylim(RMIN, RMAX)
ax.set_rorigin(RMIN)

# month ticks
ax.set_xticks(np.linspace(0, 2*np.pi, 12, endpoint=False))
ax.set_xticklabels(list("JFMAMJJASOND"), color="#9aa3ad", fontsize=13)
ax.tick_params(axis="x", pad=6)
ax.set_yticklabels([])
ax.set_rticks([])
ax.spines["polar"].set_visible(False)
ax.grid(False)

# reference rings
def ring(val, color, label=None, ls="-", lw=1.0, alpha=0.85):
    t = np.linspace(0, 2*np.pi, 400)
    ax.plot(t, np.full_like(t, val), color=color, lw=lw, ls=ls, alpha=alpha, zorder=1)
    if label:  # placed at top (north), where outer rings are empty of data
        ax.text(0.0, val, label, color=color, fontsize=11.5,
                ha="center", va="center", zorder=5, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.2", fc="#000000", ec="none", alpha=0.85))
ring(0.0, "#5a6470", None, lw=1.0, alpha=0.6)
ring(1.5, "#f1932a", "+1.5 \u00b0C", ls="--", lw=1.2)
ring(2.0, "#e23b3b", "+2.0 \u00b0C", ls="--", lw=1.2)

# growing spiral (LineCollection) + comet head + center year
points = np.column_stack([theta, r])
segs_all = np.stack([points[:-1], points[1:]], axis=1)
lc = LineCollection([], linewidths=1.5, capstyle="round")
ax.add_collection(lc)
head, = ax.plot([], [], "o", ms=7, mfc="#ffffff", mec="#ffffff", zorder=6)
glow, = ax.plot([], [], "o", ms=16, mfc="#ffffff", mec="none", alpha=0.25, zorder=5)
yeartxt = ax.text(0, RMIN, "", color="#ffffff", fontsize=34, fontweight="bold",
                  ha="center", va="center", zorder=7)
fig.text(0.5, 0.955, "Globale Temperaturabweichung 1880\u20132025",
         color="#e8ebef", fontsize=17, ha="center", fontweight="bold")
fig.text(0.5, 0.028, "NASA GISTEMP v4  \u00b7  Basis 1951\u20131980  \u00b7  monatlich",
         color="#7a828c", fontsize=11, ha="center")

FPS = 30
def update(k):
    # k = number of points drawn (1..N)
    if k >= 2:
        lc.set_segments(segs_all[:k-1])
        lc.set_color(seg_colors[:k-1])
    head.set_data([theta[k-1]], [r[k-1]])
    glow.set_data([theta[k-1]], [r[k-1]])
    yeartxt.set_text(str(years[k-1]))
    return lc, head, glow, yeartxt

frames = range(2, N+1)
anim = FuncAnimation(fig, update, frames=frames, interval=1000/FPS, blit=False)
writer = FFMpegWriter(fps=FPS, bitrate=4500,
                      extra_args=["-pix_fmt","yuv420p","-movflags","+faststart"])
anim.save("/mnt/user-data/outputs/climate_spiral_1880-2025.mp4", writer=writer,
          savefig_kwargs={"facecolor":"#000000"})
print("done frames:", N-1)
