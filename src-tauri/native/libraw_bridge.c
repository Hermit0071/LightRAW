#include <libraw.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  uint8_t *data;
  size_t data_size;
  uint32_t width;
  uint32_t height;
  uint16_t colors;
  char camera[160];
  char error[256];
} lightraw_raw_preview;

static int fail(lightraw_raw_preview *output, libraw_data_t *raw, int code) {
  snprintf(output->error, sizeof(output->error), "%s", libraw_strerror(code));
  if (raw != NULL) {
    libraw_close(raw);
  }
  return code;
}

int lightraw_decode_raw(const char *path, uint32_t max_dimension,
                        lightraw_raw_preview *output) {
  memset(output, 0, sizeof(*output));
  libraw_data_t *raw = libraw_init(0);
  if (raw == NULL) {
    snprintf(output->error, sizeof(output->error), "LibRaw initialization failed");
    return -1;
  }

  int code = libraw_open_file(raw, path);
  if (code != LIBRAW_SUCCESS) {
    return fail(output, raw, code);
  }

  snprintf(output->camera, sizeof(output->camera), "%s %s",
           raw->idata.normalized_make[0] ? raw->idata.normalized_make : raw->idata.make,
           raw->idata.normalized_model[0] ? raw->idata.normalized_model : raw->idata.model);

  uint32_t longest = raw->sizes.width > raw->sizes.height ? raw->sizes.width : raw->sizes.height;
  raw->params.half_size = max_dimension > 0 && longest > max_dimension * 2;
  raw->params.use_camera_wb = 1;
  raw->params.no_auto_bright = 1;
  raw->params.output_bps = 16;
  raw->params.output_color = 1;
  raw->params.gamm[0] = 1.0;
  raw->params.gamm[1] = 1.0;

  code = libraw_unpack(raw);
  if (code != LIBRAW_SUCCESS) {
    return fail(output, raw, code);
  }
  code = libraw_dcraw_process(raw);
  if (code != LIBRAW_SUCCESS) {
    return fail(output, raw, code);
  }

  int memory_error = LIBRAW_SUCCESS;
  libraw_processed_image_t *image = libraw_dcraw_make_mem_image(raw, &memory_error);
  if (image == NULL || memory_error != LIBRAW_SUCCESS) {
    return fail(output, raw, memory_error);
  }
  if (image->type != LIBRAW_IMAGE_BITMAP || image->bits != 16 || image->colors < 3) {
    libraw_dcraw_clear_mem(image);
    return fail(output, raw, LIBRAW_UNSPECIFIED_ERROR);
  }

  output->data = malloc(image->data_size);
  if (output->data == NULL) {
    libraw_dcraw_clear_mem(image);
    return fail(output, raw, LIBRAW_UNSUFFICIENT_MEMORY);
  }
  memcpy(output->data, image->data, image->data_size);
  output->data_size = image->data_size;
  output->width = image->width;
  output->height = image->height;
  output->colors = image->colors;

  libraw_dcraw_clear_mem(image);
  libraw_close(raw);
  return LIBRAW_SUCCESS;
}

void lightraw_free_raw_preview(lightraw_raw_preview *preview) {
  free(preview->data);
  preview->data = NULL;
  preview->data_size = 0;
}
