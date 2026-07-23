# Third-party model manifest

| Component | Pinned source | License | Runtime role |
| --- | --- | --- | --- |
| Stable Diffusion 2 Inpainting FP16 | `sd2-community/stable-diffusion-2-inpainting@5f74973cbb64c8568780732c17f43eb269d63a0d` | CreativeML OpenRAIL++-M | Masked hair generation |
| BiSeNet ResNet18 ONNX | `yakhyo/face-parsing`, release asset `resnet18.onnx` | MIT | Hair/face semantic mask |
| PyTorch 2.7.1 + CUDA 12.6 | Official PyTorch wheel index | BSD-style | GPU inference runtime |

The setup downloads safetensors pipeline components only. It does not load the repository's 5.21 GB pickle checkpoint. Customer images remain on the local machine and are never sent to these model repositories.

Sources:

- https://huggingface.co/sd2-community/stable-diffusion-2-inpainting
- https://github.com/yakhyo/face-parsing
- https://pytorch.org/get-started/locally/
