precision mediump float;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uResolution;

varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord;

  // Sample the original pixel
  vec4 color = texture2D(uTexture, uv);

  // Bloom: sample surrounding pixels for bright areas
  vec2 texel = 1.0 / uResolution;
  vec3 bloom = vec3(0.0);
  float weights[9];
  weights[0] = 0.077; weights[1] = 0.119; weights[2] = 0.077;
  weights[3] = 0.119; weights[4] = 0.185; weights[5] = 0.119;
  weights[6] = 0.077; weights[7] = 0.119; weights[8] = 0.077;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * texel * 2.0;
      vec3 sample = texture2D(uTexture, uv + offset).rgb;
      float brightness = dot(sample, vec3(0.299, 0.587, 0.114));
      if (brightness > 0.6) {
        int idx = (y + 1) * 3 + (x + 1);
        bloom += sample * weights[idx];
      }
    }
  }

  // Heat haze effect: subtle distortion near bright areas
  float heat = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  if (heat > 0.5) {
    vec2 offset = vec2(
      sin(uv.y * 40.0 + uTime * 2.0) * 0.003 * heat,
      cos(uv.x * 40.0 + uTime * 1.5) * 0.003 * heat
    );
    color = texture2D(uTexture, uv + offset);
  }

  // Combine bloom and original
  color.rgb += bloom * 0.6;
  color.rgb = clamp(color.rgb, 0.0, 1.0);

  gl_FragColor = color;
}
