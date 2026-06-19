// Minimal map projection viewer using raylib 6.0
// Usage: ./viewer equirectangular_image.png
//
// Buttons (top bar):  [ Equirectangular ] [ Mercator ] [ Sphere ]
// Flat maps are drawn on a cube, the sphere as a sphere.
// Projection is performed in a fragment shader (re-mapping the
// equirectangular texture coordinates).
//
// Controls:
//   - Left click + drag : rotate central object
//   - Shift + left drag : pan
//   - Scroll wheel      : zoom

#include "raylib.h"
#include "raymath.h"
#include <math.h>
#include <stdio.h>

// Projection modes
#define PROJ_EQUIRECT 0
#define PROJ_MERCATOR 1
#define PROJ_SPHERE 2

#define BAR_HEIGHT 44

// ----------------------------------------------------------------------------
// Shaders (GLSL 330) embedded as strings
// ----------------------------------------------------------------------------
// clang-format off
static const char *vsCode =
"#version 330\n"
"in vec3 vertexPosition;\n"
"in vec2 vertexTexCoord;\n"
"in vec4 vertexColor;\n"
"uniform mat4 mvp;\n"
"out vec2 fragTexCoord;\n"
"out vec4 fragColor;\n"
"void main(){\n"
"    fragTexCoord = vertexTexCoord;\n"
"    fragColor = vertexColor;\n"
"    gl_Position = mvp*vec4(vertexPosition, 1.0);\n"
"}\n";

static const char *fsCode =
"#version 330\n"
"in vec2 fragTexCoord;\n"
"in vec4 fragColor;\n"
"out vec4 finalColor;\n"
"uniform sampler2D texture0;\n"
"uniform vec4 colDiffuse;\n"
"uniform int projMode;\n"
"const float PI = 3.14159265359;\n"
"void main(){\n"
"    vec2 uv = fragTexCoord;\n"
"    if (projMode == 1) {\n"
"        // Mercator: the quad's vertical axis is the (normalized) mercator y\n"
"        // coordinate in [-PI, PI] (a square map). Invert it to a latitude and\n"
"        // re-sample the equirectangular texture.\n"
"        float yMerc = (uv.y - 0.5) * 2.0 * PI;\n"
"        float lat = 2.0 * atan(exp(yMerc)) - PI/2.0;\n"
"        uv.y = lat / PI + 0.5;\n"
"    } else if (projMode == 2) {\n"
"        // Sphere\n"
"        uv = vec2(uv.y, uv.x); \n"
"    } else {\n"
"        // Flat maps: image row 0 (north) is at v=0 (top of the texture); the\n"
"        // quad's v increases downward, so flip to place north on top.\n"
"        uv.y = 1.0 - uv.y;\n"
"    }\n"
"    finalColor = texture(texture0, uv) * colDiffuse * fragColor;\n"
"}\n";
// clang-format on

// ----------------------------------------------------------------------------
// Simple immediate-mode button
// ----------------------------------------------------------------------------
static bool Button(Rectangle r, const char *text, bool active) {
  Vector2 m = GetMousePosition();
  bool hover = CheckCollisionPointRec(m, r);

  Color bg;
  if (active)
    bg = (Color){70, 130, 180, 255};
  else if (hover)
    bg = (Color){95, 95, 95, 255};
  else
    bg = (Color){60, 60, 60, 255};

  DrawRectangleRec(r, bg);
  DrawRectangleLinesEx(r, 1, LIGHTGRAY);

  int fs = 18;
  int fw = MeasureText(text, fs);
  DrawText(text, (int)(r.x + (r.width - fw) / 2),
           (int)(r.y + (r.height - fs) / 2), fs, RAYWHITE);

  return hover && IsMouseButtonPressed(MOUSE_BUTTON_LEFT);
}

int main(int argc, char **argv) {
  if (argc < 2) {
    printf("Usage: %s <equirectangular_image>\n", argv[0]);
    return 1;
  }

  SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_MSAA_4X_HINT);
  InitWindow(800, 600, "Map Projection Viewer");
  SetTargetFPS(60);

  // Load the equirectangular image as a texture
  Image img = LoadImage(argv[1]);
  Texture2D tex = LoadTextureFromImage(img);
  UnloadImage(img);
  SetTextureFilter(tex, TEXTURE_FILTER_BILINEAR);

  // Projection shader
  Shader shader = LoadShaderFromMemory(vsCode, fsCode);
  int projModeLoc = GetShaderLocation(shader, "projMode");

  // Geometry: a cube for flat maps, a sphere for the globe
  Model cubeModel = LoadModelFromMesh(GenMeshCube(2.0f, 2.0f, 2.0f));
  Model sphereModel = LoadModelFromMesh(GenMeshSphere(1.3f, 48, 48));

  cubeModel.materials[0].shader = shader;
  sphereModel.materials[0].shader = shader;
  SetMaterialTexture(&cubeModel.materials[0], MATERIAL_MAP_DIFFUSE, tex);
  SetMaterialTexture(&sphereModel.materials[0], MATERIAL_MAP_DIFFUSE, tex);

  // Camera
  Camera3D camera = {0};
  camera.position = (Vector3){0.0f, 0.0f, 5.0f};
  camera.target = (Vector3){0.0f, 0.0f, 0.0f};
  camera.up = (Vector3){0.0f, 1.0f, 0.0f};
  camera.fovy = 45.0f;
  camera.projection = CAMERA_PERSPECTIVE;

  // Interaction state
  int projMode = PROJ_EQUIRECT;
  float yaw = 0.0f;
  float pitch = 0.0f;
  Vector2 pan = {0.0f, 0.0f};
  float zoom = 5.0f;

  while (!WindowShouldClose()) {
    // ----- Input -------------------------------------------------------
    Vector2 m = GetMousePosition();
    bool overBar = (m.y < BAR_HEIGHT);

    // Zoom (scroll wheel)
    float wheel = GetMouseWheelMove();
    if (wheel != 0.0f) {
      zoom -= wheel * 0.4f;
      if (zoom < 1.6f)
        zoom = 1.6f;
      if (zoom > 20.0f)
        zoom = 20.0f;
    }

    // Drag (only when starting below the toolbar)
    if (IsMouseButtonDown(MOUSE_BUTTON_LEFT) && !overBar) {
      Vector2 d = GetMouseDelta();
      if (IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT)) {
        pan.x += d.x * 0.005f * zoom;
        pan.y -= d.y * 0.005f * zoom;
      } else {
        yaw += d.x * 0.005f;
        pitch += d.y * 0.005f;
        if (pitch > 1.55f)
          pitch = 1.55f;
        if (pitch < -1.55f)
          pitch = -1.55f;
      }
    }

    camera.position = (Vector3){0.0f, 0.0f, zoom};
    camera.target = (Vector3){0.0f, 0.0f, 0.0f};

    // Object transform: pan * rotate(pitch, yaw)
    Model *model = (projMode == PROJ_SPHERE) ? &sphereModel : &cubeModel;
    Matrix rot = MatrixRotateXYZ((Vector3){pitch, yaw, 0.0f});
    Matrix trans = MatrixTranslate(pan.x, pan.y, 0.0f);
    model->transform = MatrixMultiply(rot, trans);

    // Shader uniform
    int pm = projMode;
    SetShaderValue(shader, projModeLoc, &pm, SHADER_UNIFORM_INT);

    // ----- Draw --------------------------------------------------------
    BeginDrawing();
    ClearBackground((Color){25, 25, 30, 255});

    BeginMode3D(camera);
    DrawModel(*model, (Vector3){0.0f, 0.0f, 0.0f}, 1.0f, WHITE);
    EndMode3D();

    // Toolbar
    DrawRectangle(0, 0, GetScreenWidth(), BAR_HEIGHT, (Color){40, 40, 45, 255});

    float bw = 180.0f, bh = 32.0f, by = (BAR_HEIGHT - bh) / 2.0f, gap = 8.0f,
          bx = 8.0f;
    if (Button((Rectangle){bx, by, bw, bh}, "Equirectangular",
               projMode == PROJ_EQUIRECT))
      projMode = PROJ_EQUIRECT;
    bx += bw + gap;
    if (Button((Rectangle){bx, by, 120, bh}, "Mercator",
               projMode == PROJ_MERCATOR))
      projMode = PROJ_MERCATOR;
    bx += 120 + gap;
    if (Button((Rectangle){bx, by, 110, bh}, "Sphere", projMode == PROJ_SPHERE))
      projMode = PROJ_SPHERE;

    DrawText("drag: rotate   shift+drag: pan   wheel: zoom", 8,
             GetScreenHeight() - 22, 16, (Color){180, 180, 180, 255});

    EndDrawing();
  }

  UnloadModel(cubeModel);
  UnloadModel(sphereModel);
  UnloadShader(shader);
  UnloadTexture(tex);
  CloseWindow();
  return 0;
}
