# replayflow - 0 solves / 500 pts

neural radiance fields are so efficient for 3d scene representation so surely a 2d temporal flow field would work great! i trained a neural net to represent my replay cursor movement. it's parameterized by time (float in seconds), x, and y coord (osu map coordinates) and it outputs (dx/dt, dy/dt) at each coordinate. can you get my replay?

NOTE: while time input is a float in seconds, dx/dt and dy/dt are actually in terms of milliseconds, so true velocity would be the outputs times 1000.

NOTE: the flag drawn fits the format `osu{[A-Z_]+}`, i.e. it includes osu{} and the stuff inside is all caps or underscore.

HINT: we want to obtain cursor positions, so discretely integrating velocities is an option. but neural networks have error, which we will probably have to correct for.
