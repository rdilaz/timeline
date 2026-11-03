//! Timeline's pixel work, in Rust compiled to WebAssembly.
//! Two jobs that touch every pixel, which is where WebAssembly beats plain JavaScript:
//!  - `grain`: the paper's fibre grain (multi-octave value noise per pixel)
//!  - `wash`:  the distant ink-wash mountains, baked into one bitmap (used by fast mode)
//! No allocator crate, no bindings: one output buffer the page reads directly.

static mut BUF: Vec<u8> = Vec::new();

#[inline] fn hash(n: f64) -> f64 { let v = (n * 127.1 + 311.7).sin() * 43758.5453; v - v.floor() }
#[inline] fn vn(x: f64) -> f64 { let i = x.floor(); let f = x - i; let u = f * f * (3.0 - 2.0 * f); hash(i) * (1.0 - u) + hash(i + 1.0) * u }
#[inline] fn h2(x: i32, y: i32, s: u32) -> f32 {
    let mut h = (x as u32).wrapping_mul(374761393) ^ (y as u32).wrapping_mul(668265263) ^ s.wrapping_mul(2246822519);
    h = (h ^ (h >> 13)).wrapping_mul(1274126177); h ^= h >> 16;
    (h & 0xffff) as f32 / 65535.0
}
#[inline] fn vn2(x: f32, y: f32, s: u32) -> f32 {
    let (xi, yi) = (x.floor(), y.floor()); let (fx, fy) = (x - xi, y - yi);
    let (ux, uy) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy));
    let (a, b) = (h2(xi as i32, yi as i32, s), h2(xi as i32 + 1, yi as i32, s));
    let (c, d) = (h2(xi as i32, yi as i32 + 1, s), h2(xi as i32 + 1, yi as i32 + 1, s));
    (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
}

fn buf(len: usize) -> *mut u8 {
    unsafe {
        let b = &mut *core::ptr::addr_of_mut!(BUF);
        b.clear(); b.resize(len, 0); b.as_mut_ptr()
    }
}

/// RGBA paper grain, w*h pixels. Long horizontal fibres plus fine speckle.
#[no_mangle]
pub extern "C" fn grain(w: u32, h: u32, seed: u32) -> *mut u8 {
    let p = buf((w * h * 4) as usize);
    let out = unsafe { core::slice::from_raw_parts_mut(p, (w * h * 4) as usize) };
    for y in 0..h {
        for x in 0..w {
            let (fx, fy) = (x as f32, y as f32);
            // fibres: stretched noise, four octaves
            let mut n = 0.0; let mut amp = 0.5; let mut fq = 1.0 / 48.0;
            for o in 0..4u32 { n += amp * vn2(fx * fq * 0.25, fy * fq * 2.2, seed + o); amp *= 0.5; fq *= 2.0; }
            let speck = h2(x as i32, y as i32, seed ^ 0x9e37);
            let i = ((y * w + x) * 4) as usize;
            if n > 0.62 { // light fibre
                let a = ((n - 0.62) * 2.4).min(1.0);
                out[i] = 255; out[i + 1] = 250; out[i + 2] = 236; out[i + 3] = (a * 120.0) as u8;
            } else if speck > 0.996 || n < 0.24 { // dark speck or low dip
                let a = if speck > 0.996 { 0.28 } else { (0.24 - n) * 0.5 };
                out[i] = 96; out[i + 1] = 68; out[i + 2] = 36; out[i + 3] = (a * 255.0) as u8;
            }
        }
    }
    p
}

/// RGBA ink-wash mountains, three layers, matching the page's canvas version.
/// `scale` is pixels per CSS pixel (fast mode bakes at 0.5).
#[no_mangle]
pub extern "C" fn wash(w: u32, h: u32, scale: f64) -> *mut u8 {
    let p = buf((w * h * 4) as usize);
    let out = unsafe { core::slice::from_raw_parts_mut(p, (w * h * 4) as usize) };
    let hc = h as f64 / scale; // height in CSS px
    let layers = [(0.34, 0.16, 0.07, 0.0032, 11.0), (0.41, 0.12, 0.085, 0.0055, 23.0), (0.47, 0.075, 0.1, 0.009, 37.0)];
    for x in 0..w {
        let px = x as f64 / scale;
        let mut ridge = [0.0f64; 3];
        for (k, l) in layers.iter().enumerate() {
            let pr = vn(px * l.3 + l.4) * 0.6 + vn(px * l.3 * 2.7 + l.4 * 2.0) * 0.3 + vn(px * l.3 * 8.0 + l.4 * 3.0) * 0.1;
            ridge[k] = hc * l.0 - hc * l.1 * pr.powf(1.5) * 1.9;
        }
        for y in 0..h {
            let py = y as f64 / scale;
            let mut a = 0.0f64;
            for (k, l) in layers.iter().enumerate() {
                let base = hc * l.0; let top = base - hc * l.1 * 1.9; let bot = base + hc * 0.12;
                if py >= ridge[k] && py <= bot {
                    let t = ((py - top) / (bot - top)).clamp(0.0, 1.0);
                    let la = if t < 0.55 { l.2 * (1.0 - t / 0.55 * 0.45) } else { l.2 * 0.55 * (1.0 - (t - 0.55) / 0.45) };
                    a = a + la * (1.0 - a);
                }
            }
            let i = ((y * w + x) * 4) as usize;
            out[i] = 23; out[i + 1] = 19; out[i + 2] = 15; out[i + 3] = (a * 255.0).min(255.0) as u8;
        }
    }
    p
}
