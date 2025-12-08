use rand::{rngs::StdRng, Rng, SeedableRng};

const FRAME_TIME: f64 = 0.0666;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Strategy {
    Front, // Nige
    Pace,  // Senkou
    Late,  // Sashi
    End,   // Oikomi
}

impl Strategy {
    pub fn get_name(&self) -> &str {
        match self {
            Strategy::Front => "Front (Runner)",
            Strategy::Pace => "Pace (Leader)",
            Strategy::Late => "Late (Betweener)",
            Strategy::End => "End (Chaser)",
        }
    }

    fn get_coeffs(&self) -> StrategyCoeffs {
        match self {
            Strategy::Front => StrategyCoeffs {
                speed_coef: [1.0, 0.98, 0.962],
                accel_coef: [1.0, 1.0, 0.996],
                hp_coef: 0.95,
            },
            Strategy::Pace => StrategyCoeffs {
                speed_coef: [0.978, 0.991, 0.975],
                accel_coef: [0.985, 1.0, 0.996],
                hp_coef: 0.89,
            },
            Strategy::Late => StrategyCoeffs {
                speed_coef: [0.938, 0.998, 0.994],
                accel_coef: [0.975, 1.0, 1.0],
                hp_coef: 1.0,
            },
            Strategy::End => StrategyCoeffs {
                speed_coef: [0.931, 1.0, 1.0],
                accel_coef: [0.945, 1.0, 0.997],
                hp_coef: 0.995,
            },
        }
    }
}
struct StrategyCoeffs {
    speed_coef: [f64; 3],
    accel_coef: [f64; 3],
    hp_coef: f64,
}

#[derive(Debug)]
struct Stats {
    speed: f64,
    stamina: f64,
    power: f64,
    guts: f64,
    wit: f64,
}

#[derive(Debug)]
struct Horse {
    name: String,
    stats: Stats,
    strategy: Strategy,
    distance_covered: f64,
    current_speed: f64,
    finish_time: Option<f64>,
    max_hp: f64,
    current_hp: f64,
    phase: usize,
    is_spurt_active: bool,
    out_of_hp: bool,
    start_dash_active: bool,
    random_fluctuation: f64,
}

impl Horse {
    fn new(
        name: &str,
        speed: f64,
        stamina: f64,
        power: f64,
        guts: f64,
        wit: f64,
        strategy: Strategy,
    ) -> Self {
        let random_fluctuation = (wit / 5500.0) * (wit * 0.1).log10();

        Horse {
            name: name.to_string(),
            stats: Stats {
                speed,
                stamina,
                power,
                guts,
                wit,
            },
            strategy,
            distance_covered: 0.0,
            current_speed: 3.0,
            finish_time: None,
            max_hp: 0.0,
            current_hp: 0.0,
            phase: 0,
            is_spurt_active: false,
            out_of_hp: false,
            start_dash_active: true,
            random_fluctuation,
        }
    }

    fn initialize_race(&mut self, race_distance: f64) {
        let coeffs = self.strategy.get_coeffs();
        self.max_hp = 0.8 * coeffs.hp_coef * self.stats.stamina + race_distance;
        self.current_hp = self.max_hp;
        self.distance_covered = 0.0;
        self.current_speed = 3.0;
        self.finish_time = None;
        self.phase = 0;
        self.is_spurt_active = false;
        self.out_of_hp = false;
        self.start_dash_active = true;
    }

    fn update<R: Rng + ?Sized>(
        &mut self,
        dt: f64,
        race_base_speed: f64,
        race_distance: f64,
        rng: &mut R,
    ) {
        if self.finish_time.is_some() {
            return;
        }

        let progress = self.distance_covered / race_distance;
        if progress < 0.166 {
            self.phase = 0;
        } else if progress < 0.666 {
            self.phase = 1;
        } else {
            self.phase = 2;
        }

        let coeffs = self.strategy.get_coeffs();
        let coef_idx = if self.phase >= 2 { 2 } else { self.phase };

        let mut target_speed = race_base_speed * coeffs.speed_coef[coef_idx];
        let wit_shift = (self.stats.wit / 10000.0).min(0.004);
        let wiggle = rng.gen_range(
            (self.random_fluctuation - 0.0065 - wit_shift)
                ..(self.random_fluctuation + wit_shift),
        );
        target_speed *= 1.0 + wiggle;

        if self.phase == 2 {
            let base_late_boost = (500.0 * self.stats.speed).sqrt() * 0.002;
            target_speed += base_late_boost;

            if !self.is_spurt_active && !self.out_of_hp {
                let guts_factor = (450.0 * self.stats.guts).powf(0.597) * 0.0001;
                let max_spurt_target =
                    (target_speed + 0.01 * race_base_speed) * 1.05 + base_late_boost + guts_factor;

                let dist_remain = race_distance - self.distance_covered;
                let time_remain = dist_remain / max_spurt_target;

                let hp_cost_est = 20.0 * (max_spurt_target - race_base_speed + 12.0).powi(2) / 144.0;
                let guts_save = 1.0 + (200.0 / (600.0 * self.stats.guts).sqrt());
                let total_hp_needed = hp_cost_est * guts_save * time_remain;

                if self.current_hp > total_hp_needed * 0.8 {
                    self.is_spurt_active = true;
                }
            }

            if self.is_spurt_active {
                let guts_factor = (450.0 * self.stats.guts).powf(0.597) * 0.0001;
                target_speed = (target_speed + 0.01 * race_base_speed) * 1.05 + guts_factor;
                self.phase = 3;
            }
        }

        if self.current_hp <= 0.0 {
            self.out_of_hp = true;
            self.current_hp = 0.0;
            let min_speed = 0.85 * race_base_speed + (200.0 * self.stats.guts).sqrt() * 0.001;
            target_speed = min_speed;
        }

        let mut base_accel = 0.0006;

        if self.start_dash_active {
            if self.current_speed < 0.85 * race_base_speed && self.phase == 0 {
                base_accel = 24.0;
            } else {
                self.start_dash_active = false;
            }
        }

        let accel = base_accel * (500.0 * self.stats.power).sqrt() * coeffs.accel_coef[coef_idx];

        if self.current_speed < target_speed {
            self.current_speed += accel * dt;
            if self.current_speed > target_speed {
                self.current_speed = target_speed;
            }
        } else {
            let mut decel = -1.0;
            if self.phase == 0 {
                decel = -1.2;
            } else if self.phase == 1 {
                decel = -0.8;
            }

            if self.out_of_hp {
                decel = -1.2;
            }

            self.current_speed += decel * dt;
            if self.current_speed < target_speed {
                self.current_speed = target_speed;
            }
        }

        if self.current_speed > 30.0 {
            self.current_speed = 30.0;
        }

        let mut hp_consumption = 20.0 * (self.current_speed - race_base_speed + 12.0).powi(2) / 144.0;

        if self.phase >= 2 {
            let guts_mod = 1.0 + (200.0 / (600.0 * self.stats.guts).sqrt());
            hp_consumption *= guts_mod;
        }

        self.current_hp -= hp_consumption * dt;
        self.distance_covered += self.current_speed * dt;
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct RaceEntry {
    pub name: String,
    pub speed: f64,
    pub stamina: f64,
    pub power: f64,
    pub guts: f64,
    pub wit: f64,
    pub strategy: Strategy,
}

#[derive(Clone, Debug, PartialEq)]
pub struct RaceResult {
    pub index: usize,
    pub name: String,
    pub finish_time: f64,
    pub exhausted: bool,
}

pub fn simulate_race(entries: &[RaceEntry], distance: f64, seed: u64) -> Vec<RaceResult> {
    if entries.is_empty() {
        return Vec::new();
    }

    let mut rng = StdRng::seed_from_u64(seed);
    let mut horses: Vec<Horse> = entries
        .iter()
        .map(|entry| {
            let mut horse = Horse::new(
                &entry.name,
                entry.speed,
                entry.stamina,
                entry.power,
                entry.guts,
                entry.wit,
                entry.strategy,
            );
            horse.initialize_race(distance);
            horse
        })
        .collect();

    let race_base_speed = 20.0 - (distance - 2000.0) / 1000.0;
    let mut time_elapsed = 0.0;
    let mut finished_count = 0usize;
    let total = horses.len();

    while finished_count < total {
        time_elapsed += FRAME_TIME;
        finished_count = 0;
        for horse in horses.iter_mut() {
            horse.update(FRAME_TIME, race_base_speed, distance, &mut rng);
            if horse.distance_covered >= distance && horse.finish_time.is_none() {
                horse.finish_time = Some(time_elapsed);
            }
            if horse.finish_time.is_some() {
                finished_count += 1;
            }
        }
    }

    let mut results: Vec<RaceResult> = horses
        .into_iter()
        .enumerate()
        .map(|(idx, horse)| {
            let name = horse.name;
            let exhausted = horse.out_of_hp;
            let finish_time = horse.finish_time.unwrap_or(time_elapsed);
            RaceResult {
                index: idx,
                name,
                finish_time,
                exhausted,
            }
        })
        .collect();

    results.sort_by(|a, b| a
        .finish_time
        .partial_cmp(&b.finish_time)
        .unwrap());
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_simulation() {
        let entries = vec![
            RaceEntry {
                name: "Silent Suzuka".to_string(),
                speed: 1200.0,
                stamina: 800.0,
                power: 800.0,
                guts: 400.0,
                wit: 900.0,
                strategy: Strategy::Front,
            },
            RaceEntry {
                name: "Gold Ship".to_string(),
                speed: 1000.0,
                stamina: 1200.0,
                power: 1200.0,
                guts: 1000.0,
                wit: 500.0,
                strategy: Strategy::End,
            },
        ];

        let first = simulate_race(&entries, 2400.0, 42);
        let second = simulate_race(&entries, 2400.0, 42);
        assert_eq!(first, second);
    }
}