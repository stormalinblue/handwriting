import json
import sqlite3

import matplotlib.pyplot as plt
import numpy as np

def segments_range(segments):
  x_max = -np.inf
  x_min = np.inf
  y_max = -np.inf
  y_min = np.inf
  t_max = -np.inf
  t_min = np.inf

  for segment in segments:
    xs, ys, ts = segment
    x_max = max(x_max, np.max(xs))
    x_min = min(x_min, np.min(xs))
    y_max = max(y_max, np.max(ys))
    y_min = min(y_min, np.min(ys))
    t_max = max(t_max, np.max(ts))
    t_min = min(t_min, np.min(ts))

  return ((x_min, x_max), (y_min, y_max), (t_min, t_max))

def flip_ys(segments):
  return [(xs, -ys, ts) for (xs, ys, ts) in segments]

def normalize_segments(segments):
  flipped = flip_ys(segments)

  ((x_min, x_max), (y_min, y_max), (t_min, t_max)) = segments_range(flipped)

  new_segments = []

  for segment in flipped:
    (xs, ys, ts) = segment

    shrink = x_max - x_min

    new_xs = (xs - x_min) / shrink - 0.5
    new_ys = ((ys - y_min) / shrink) - (y_max - y_min) / (2 * shrink)
    new_ts = (ts - t_min) / (t_max - t_min)
    new_segments.append((new_xs, new_ys, new_ts))

  return new_segments

def traj_to_segments(traj):
  segments = []

  xs = []
  ys = []
  ts = []
  pen_up = True

  for update in traj:
    if update['type'] == 'down':
      pen_up = False
    elif update['type'] == 'up':
      pen_up = True

    if not pen_up:
      xs.append(update['x'])
      ys.append(update['y'])
      ts.append(update['t'])


    if update['type'] == 'up':
      x_array = np.asarray(xs, dtype=np.float32)
      y_array = np.asarray(ys, dtype=np.float32)
      t_array = np.asarray(ts, dtype=np.float32)

      raw_segment = (x_array, y_array, t_array)

      segments.append(raw_segment)

      xs = []
      ys = []
      ts = []

  return normalize_segments(segments)

def plot_segments(ax, segments):
  for segment in segments:
    x, y, _ = segment

    ax.plot(x, y, color=(0, 0, 1, 0.5))
    ax.set_aspect(1)

def plot_segment_times(ax, segments):
  for segment in segments:
    _, _, t = segment

    ax.plot(t, t)
    ax.set_aspect(1)

if __name__ == '__main__':
  conn = sqlite3.connect(
    'file:../handwriting_server/test.db?mode=ro',
    uri=True)

  prompts_result = conn.execute('''
      select distinct prompt
      from prompts
      where length(prompt) = 2
      order by prompt''').fetchall()
  prompts = [x[0] for x in prompts_result]

  fig, axs = plt.subplots(26, 26)
  for prompt_index, prompt in enumerate(prompts):
    print('working on', prompt)
    traj_json_strings = conn.execute('''
      select trajectory from demos
      join prompts on demos.prompt_id = prompts.uuid
      where prompt = ?
      order by prompts.uuid desc limit ?;
      ''', (prompt, 50)).fetchall()

    row_index = ord(prompt[0]) - ord('a')
    col_index = ord(prompt[1]) - ord('a')

    ax = axs[row_index][col_index]
    # ax.set_title(prompt)
    ax.set_axis_off()

    for traj_string in traj_json_strings:
      traj = json.loads(traj_string[0])
      segments = traj_to_segments(traj)
      plot_segments(ax, segments)

    print('done with', prompt)
  plt.show(block=True)
