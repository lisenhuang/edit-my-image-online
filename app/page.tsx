"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Crop,
  RotateCw,
  ImageIcon,
  Upload,
  Download,
  Sliders,
  Type,
  FlipHorizontal,
  FlipVertical,
  Undo,
  Redo,
  Scissors,
  Plus,
  Trash2,
  Github,
} from "lucide-react"
import { ThemeLanguageSwitcher } from "@/components/theme-language-switcher"
import { useLanguage } from "@/contexts/language-context"

// Define crop drag modes
type CropDragMode =
  | "create"
  | "move"
  | "resize-nw"
  | "resize-ne"
  | "resize-sw"
  | "resize-se"
  | "resize-n"
  | "resize-e"
  | "resize-s"
  | "resize-w"
  | null

// Define text element type
interface TextElement {
  id: string
  content: string
  position: { x: number; y: number }
  size: number
  color: string
}

export default function ImageEditor() {
  const { t } = useLanguage()
  const [image, setImage] = useState<string | null>(null)
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [cropMode, setCropMode] = useState(false)
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 })
  const [cropEnd, setCropEnd] = useState({ x: 0, y: 0 })
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [rotation, setRotation] = useState(0)

  // Replace single text with array of text elements
  const [textElements, setTextElements] = useState<TextElement[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [newTextContent, setNewTextContent] = useState("")
  const [newTextSize, setNewTextSize] = useState(20)
  const [newTextColor, setNewTextColor] = useState("#000000")

  const [imageFormat, setImageFormat] = useState("png")
  const [imageQuality, setImageQuality] = useState(90)
  const [imageWidth, setImageWidth] = useState(0)
  const [imageHeight, setImageHeight] = useState(0)
  const [aspectRatio, setAspectRatio] = useState(1)
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [displayedWidth, setDisplayedWidth] = useState(0)
  const [displayedHeight, setDisplayedHeight] = useState(0)

  // Add new state variables for crop adjustment
  const [cropDragMode, setCropDragMode] = useState<CropDragMode>(null)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  const [cropRectBeforeDrag, setCropRectBeforeDrag] = useState({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
  })

  // Store the original image data for drawing
  const [originalImageObj, setOriginalImageObj] = useState<HTMLImageElement | null>(null)

  // Add new state variables for text dragging
  const [textDragMode, setTextDragMode] = useState(false)
  const [textDragStart, setTextDragStart] = useState({ x: 0, y: 0 })
  const [textPositionBeforeDrag, setTextPositionBeforeDrag] = useState({ x: 0, y: 0 })
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get selected text element
  const selectedText = selectedTextId ? textElements.find((t) => t.id === selectedTextId) : null

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        setImageWidth(img.width)
        setImageHeight(img.height)
        setAspectRatio(img.width / img.height)
        setOriginalImageObj(img)

        const imgDataUrl = event.target?.result as string
        setImage(imgDataUrl)
        setOriginalImage(imgDataUrl)

        // Initialize history
        setHistory([imgDataUrl])
        setHistoryIndex(0)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Update displayed canvas dimensions when the canvas is rendered
  useEffect(() => {
    if (!canvasRef.current || !image) return

    // Use a small delay to ensure the canvas has been rendered with its final dimensions
    const updateDisplayedDimensions = () => {
      if (canvasRef.current) {
        const { width, height } = canvasRef.current.getBoundingClientRect()
        setDisplayedWidth(width)
        setDisplayedHeight(height)
      }
    }

    // Update immediately and also after a small delay to catch any layout changes
    updateDisplayedDimensions()
    const timeoutId = setTimeout(updateDisplayedDimensions, 100)

    return () => clearTimeout(timeoutId)
  }, [image, imageWidth, imageHeight])

  // Draw image on canvas
  useEffect(() => {
    if (!image || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Set canvas dimensions
      canvas.width = imageWidth
      canvas.height = imageHeight

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Apply rotation if needed
      if (rotation !== 0) {
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height)
        ctx.restore()
      } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }

      // Apply filters
      if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
          // Apply brightness
          const brightnessValue = brightness / 100
          data[i] = data[i] * brightnessValue // Red
          data[i + 1] = data[i + 1] * brightnessValue // Green
          data[i + 2] = data[i + 2] * brightnessValue // Blue

          // Apply contrast
          const contrastValue = (contrast - 100) / 100
          for (let j = 0; j < 3; j++) {
            data[i + j] = ((data[i + j] / 255 - 0.5) * (contrastValue + 1) + 0.5) * 255
          }

          // Apply saturation
          const saturationValue = saturation / 100
          const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2] // Luminance
          data[i] = gray + (data[i] - gray) * saturationValue // Red
          data[i + 1] = gray + (data[i + 1] - gray) * saturationValue // Green
          data[i + 2] = gray + (data[i + 2] - gray) * saturationValue // Blue

          // Ensure values stay within valid range (0-255)
          for (let j = 0; j < 3; j++) {
            data[i + j] = Math.max(0, Math.min(255, data[i + j]))
          }
        }

        ctx.putImageData(imageData, 0, 0)
      }

      // Draw all text elements
      textElements.forEach((textEl) => {
        ctx.font = `${textEl.size}px Arial`
        ctx.fillStyle = textEl.color
        ctx.fillText(textEl.content, textEl.position.x, textEl.position.y)

        // Draw highlight around selected text
        if (textEl.id === selectedTextId) {
          const metrics = ctx.measureText(textEl.content)
          const textWidth = metrics.width
          const textHeight = textEl.size

          ctx.strokeStyle = "#3b82f6" // Blue highlight
          ctx.lineWidth = 1
          ctx.setLineDash([5, 3]) // Dashed line
          ctx.strokeRect(textEl.position.x - 4, textEl.position.y - textHeight - 4, textWidth + 8, textHeight + 8)
          ctx.setLineDash([]) // Reset dash
        }
      })

      // Draw crop overlay if in crop mode
      if (cropMode && cropStart.x !== cropEnd.x && cropStart.y !== cropEnd.y) {
        const x = Math.min(cropStart.x, cropEnd.x)
        const y = Math.min(cropStart.y, cropEnd.y)
        const width = Math.abs(cropEnd.x - cropStart.x)
        const height = Math.abs(cropEnd.y - cropStart.y)

        // 计算显示比例
        const scaleX = displayedWidth / imageWidth
        const scaleY = displayedHeight / imageHeight

        // 计算实际的像素尺寸
        const actualWidth = Math.round(width / scaleX)
        const actualHeight = Math.round(height / scaleY)

        if (width === 0 || height === 0) return

        // Create a copy of the current canvas state
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // Draw semi-transparent overlay over the entire image
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw the original image data only in the crop area
        ctx.putImageData(currentImageData, 0, 0, x, y, width, height)

        // Draw border around crop area
        ctx.strokeStyle = "red"
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)

        // Draw resize handles at corners and edges
        const handleSize = 8
        ctx.fillStyle = "white"

        // Corner handles
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize) // Top-left
        ctx.fillRect(x + width - handleSize / 2, y - handleSize / 2, handleSize, handleSize) // Top-right
        ctx.fillRect(x - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize) // Bottom-left
        ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize) // Bottom-right

        // Edge handles
        ctx.fillRect(x + width / 2 - handleSize / 2, y - handleSize / 2, handleSize, handleSize) // Top
        ctx.fillRect(x + width - handleSize / 2, y + height / 2 - handleSize / 2, handleSize, handleSize) // Right
        ctx.fillRect(x + width / 2 - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize) // Bottom
        ctx.fillRect(x - handleSize / 2, y + height / 2 - handleSize / 2, handleSize, handleSize) // Left

        // Display dimensions using actual pixel values
        const dimensionText = `${actualWidth} × ${actualHeight}`

        // 计算文本大小，根据裁剪区域的大小进行缩放，但设置最小和最大值
        const baseFontSize = 14
        const scaleFactor = Math.min(width, height) / 100 // 根据裁剪区域大小计算缩放因子
        const fontSize = Math.max(baseFontSize, Math.min(baseFontSize * scaleFactor, 32)) // 限制字体大小在14-32之间

        // Set text style with dynamic font size
        ctx.font = `${fontSize}px Arial`
        ctx.fillStyle = "white"
        ctx.textAlign = "center"

        // Create background for text
        const textMetrics = ctx.measureText(dimensionText)
        const textWidth = textMetrics.width + fontSize // 增加内边距，使用字体大小作为参考
        const textHeight = fontSize * 1.5 // 文本框高度也根据字体大小调整
        const textX = x + width / 2
        const textY = y + height + fontSize * 1.2 // 调整文本位置，使用字体大小作为参考

        // Draw text background
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
        ctx.fillRect(textX - textWidth / 2, textY - textHeight / 2, textWidth, textHeight)

        // Draw text with vertical centering
        ctx.fillStyle = "white"
        ctx.fillText(dimensionText, textX, textY + fontSize / 3) // 调整文本垂直位置以居中
      }
    }
    img.src = image
  }, [
    image,
    imageWidth,
    imageHeight,
    rotation,
    brightness,
    contrast,
    saturation,
    textElements,
    selectedTextId,
    cropMode,
    cropStart,
    cropEnd,
  ])

  // Convert display coordinates to actual image coordinates
  const convertCoordinates = (displayX: number, displayY: number) => {
    if (!canvasRef.current || displayedWidth === 0 || displayedHeight === 0) {
      return { x: displayX, y: displayY }
    }

    // Calculate the scale factors
    const scaleX = imageWidth / displayedWidth
    const scaleY = imageHeight / displayedHeight

    // Convert display coordinates to actual image coordinates
    return {
      x: displayX * scaleX,
      y: displayY * scaleY,
    }
  }

  // Check if a point is inside a text element's bounding box
  const isPointInTextElement = (x: number, y: number, textEl: TextElement) => {
    if (!canvasRef.current) return false

    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return false

    ctx.font = `${textEl.size}px Arial`
    const metrics = ctx.measureText(textEl.content)
    const textWidth = metrics.width
    const textHeight = textEl.size

    return (
      x >= textEl.position.x &&
      x <= textEl.position.x + textWidth &&
      y >= textEl.position.y - textHeight &&
      y <= textEl.position.y
    )
  }

  // Find text element at a given point
  const findTextElementAtPoint = (x: number, y: number) => {
    // Check in reverse order to select the top-most text element first
    for (let i = textElements.length - 1; i >= 0; i--) {
      if (isPointInTextElement(x, y, textElements[i])) {
        return textElements[i]
      }
    }
    return null
  }

  // Determine crop drag mode based on mouse position
  const getCropDragMode = (x: number, y: number): CropDragMode => {
    if (!cropMode || cropStart.x === cropEnd.x || cropStart.y === cropEnd.y) {
      return "create"
    }

    const cropX = Math.min(cropStart.x, cropEnd.x)
    const cropY = Math.min(cropStart.y, cropEnd.y)
    const cropWidth = Math.abs(cropEnd.x - cropStart.x)
    const cropHeight = Math.abs(cropEnd.y - cropStart.y)
    const handleSize = 16 // Larger hit area for handles

    // Check if mouse is over corner handles
    if (Math.abs(x - cropX) <= handleSize && Math.abs(y - cropY) <= handleSize) {
      return "resize-nw"
    }
    if (Math.abs(x - (cropX + cropWidth)) <= handleSize && Math.abs(y - cropY) <= handleSize) {
      return "resize-ne"
    }
    if (Math.abs(x - cropX) <= handleSize && Math.abs(y - (cropY + cropHeight)) <= handleSize) {
      return "resize-sw"
    }
    if (Math.abs(x - (cropX + cropWidth)) <= handleSize && Math.abs(y - (cropY + cropHeight)) <= handleSize) {
      return "resize-se"
    }

    // Check if mouse is over edge handles
    if (Math.abs(y - cropY) <= handleSize && x > cropX && x < cropX + cropWidth) {
      return "resize-n"
    }
    if (Math.abs(x - (cropX + cropWidth)) <= handleSize && y > cropY && y < cropY + cropHeight) {
      return "resize-e"
    }
    if (Math.abs(y - (cropY + cropHeight)) <= handleSize && x > cropX && x < cropX + cropWidth) {
      return "resize-s"
    }
    if (Math.abs(x - cropX) <= handleSize && y > cropY && y < cropY + cropHeight) {
      return "resize-w"
    }

    // Check if mouse is inside crop rectangle
    if (x >= cropX && x <= cropX + cropWidth && y >= cropY && y <= cropY + cropHeight) {
      return "move"
    }

    // Otherwise, create a new crop
    return "create"
  }

  // Get cursor style based on crop drag mode
  const getCursorStyle = (mode: CropDragMode): string => {
    switch (mode) {
      case "move":
        return "move"
      case "resize-nw":
        return "nw-resize"
      case "resize-ne":
        return "ne-resize"
      case "resize-sw":
        return "sw-resize"
      case "resize-se":
        return "se-resize"
      case "resize-n":
        return "n-resize"
      case "resize-e":
        return "e-resize"
      case "resize-s":
        return "s-resize"
      case "resize-w":
        return "w-resize"
      case "create":
        return "crosshair"
      default:
        return "default"
    }
  }

  // Handle mouse move over canvas to update cursor
  const handleMouseOver = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const displayX = e.clientX - rect.left
    const displayY = e.clientY - rect.top

    // Convert to actual image coordinates
    const { x, y } = convertCoordinates(displayX, displayY)

    if (cropMode) {
      // Determine drag mode based on mouse position
      const mode = getCropDragMode(x, y)
      // Update cursor style
      canvas.style.cursor = getCursorStyle(mode)
    } else {
      // Check if mouse is over any text element
      const textEl = findTextElementAtPoint(x, y)
      if (textEl) {
        canvas.style.cursor = "move"
      } else {
        canvas.style.cursor = "default"
      }
    }
  }

  // Handle crop start
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const displayX = e.clientX - rect.left
    const displayY = e.clientY - rect.top

    // Convert to actual image coordinates
    const { x, y } = convertCoordinates(displayX, displayY)

    if (cropMode) {
      setIsMouseDown(true)

      // Determine drag mode based on mouse position
      const mode = getCropDragMode(x, y)
      setCropDragMode(mode)

      // Save starting position for the drag
      setDragStartPos({ x, y })

      // Save current crop rectangle for reference during drag
      setCropRectBeforeDrag({
        start: { ...cropStart },
        end: { ...cropEnd },
      })

      // If creating a new crop, set both start and end to current position
      if (mode === "create") {
        setCropStart({ x, y })
        setCropEnd({ x, y })
      }
    } else {
      // Check if the mouse is over any text element
      const textEl = findTextElementAtPoint(x, y)

      if (textEl) {
        setIsMouseDown(true)
        setTextDragMode(true)
        setDraggedTextId(textEl.id)
        setTextDragStart({ x, y })
        setTextPositionBeforeDrag({ ...textEl.position })
        canvas.style.cursor = "move"

        // Select the text element for editing
        setSelectedTextId(textEl.id)
      } else {
        // Deselect text if clicking outside
        setSelectedTextId(null)
      }
    }
  }

  // Handle crop move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) {
      return
    }

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const displayX = e.clientX - rect.left
    const displayY = e.clientY - rect.top

    // Convert to actual image coordinates
    const { x, y } = convertCoordinates(displayX, displayY)

    // Handle text dragging
    if (textDragMode && isMouseDown && draggedTextId) {
      // Calculate the delta from the drag start position
      const deltaX = x - textDragStart.x
      const deltaY = y - textDragStart.y

      // Update text position
      setTextElements((prev) =>
        prev.map((textEl) => {
          if (textEl.id === draggedTextId) {
            return {
              ...textEl,
              position: {
                x: textPositionBeforeDrag.x + deltaX,
                y: textPositionBeforeDrag.y + deltaY,
              },
            }
          }
          return textEl
        }),
      )

      return
    }

    // Update cursor based on what's under the mouse
    if (!isMouseDown) {
      handleMouseOver(e)
      return
    }

    // Handle crop mode
    if (cropMode) {
      // Calculate the delta from the drag start position
      const deltaX = x - dragStartPos.x
      const deltaY = y - dragStartPos.y

      // Handle different drag modes
      switch (cropDragMode) {
        case "create":
          // Simply update the end point for a new crop
          setCropEnd({ x, y })
          break

        case "move":
          // Move the entire crop rectangle
          setCropStart({
            x: cropRectBeforeDrag.start.x + deltaX,
            y: cropRectBeforeDrag.start.y + deltaY,
          })
          setCropEnd({
            x: cropRectBeforeDrag.end.x + deltaX,
            y: cropRectBeforeDrag.end.y + deltaY,
          })
          break

        case "resize-nw":
          // Resize from the top-left corner
          setCropStart({
            x: cropRectBeforeDrag.start.x + deltaX,
            y: cropRectBeforeDrag.start.y + deltaY,
          })
          break

        case "resize-ne":
          // Resize from the top-right corner
          setCropStart({
            x: cropRectBeforeDrag.start.x,
            y: cropRectBeforeDrag.start.y + deltaY,
          })
          setCropEnd({
            x: cropRectBeforeDrag.end.x + deltaX,
            y: cropRectBeforeDrag.end.y,
          })
          break

        case "resize-sw":
          // Resize from the bottom-left corner
          setCropStart({
            x: cropRectBeforeDrag.start.x + deltaX,
            y: cropRectBeforeDrag.start.y,
          })
          setCropEnd({
            x: cropRectBeforeDrag.end.x,
            y: cropRectBeforeDrag.end.y + deltaY,
          })
          break

        case "resize-se":
          // Resize from the bottom-right corner
          setCropEnd({
            x: cropRectBeforeDrag.end.x + deltaX,
            y: cropRectBeforeDrag.end.y + deltaY,
          })
          break

        case "resize-n":
          // Resize from the top edge
          setCropStart({
            x: cropRectBeforeDrag.start.x,
            y: cropRectBeforeDrag.start.y + deltaY,
          })
          break

        case "resize-e":
          // Resize from the right edge
          setCropEnd({
            x: cropRectBeforeDrag.end.x + deltaX,
            y: cropRectBeforeDrag.end.y,
          })
          break

        case "resize-s":
          // Resize from the bottom edge
          setCropEnd({
            x: cropRectBeforeDrag.end.x,
            y: cropRectBeforeDrag.end.y + deltaY,
          })
          break

        case "resize-w":
          // Resize from the left edge
          setCropStart({
            x: cropRectBeforeDrag.start.x + deltaX,
            y: cropRectBeforeDrag.start.y,
          })
          break
      }
    }
  }

  // Handle crop end and apply crop
  const handleMouseUp = () => {
    if (!canvasRef.current) return

    setIsMouseDown(false)

    if (textDragMode) {
      setTextDragMode(false)
      setDraggedTextId(null)
      canvasRef.current.style.cursor = "default"

      // Add to history after text is moved
      setTimeout(() => {
        if (!canvasRef.current) return
        addToHistory(canvasRef.current.toDataURL(`image/${imageFormat}`, imageQuality / 100))
      }, 100)
    }

    if (cropMode) {
      setCropDragMode(null)
    }
  }

  // Also add a handleMouseLeave function to handle cases where the mouse leaves the canvas while pressed
  const handleMouseLeave = () => {
    setIsMouseDown(false)
    setTextDragMode(false)
    setDraggedTextId(null)
    setCropDragMode(null)

    if (canvasRef.current) {
      canvasRef.current.style.cursor = "default"
    }
  }

  // Add new text element
  const addTextElement = () => {
    if (!image || !newTextContent.trim()) return

    const newText: TextElement = {
      id: Date.now().toString(),
      content: newTextContent,
      position: { x: imageWidth / 2, y: imageHeight / 2 },
      size: newTextSize,
      color: newTextColor,
    }

    setTextElements((prev) => [...prev, newText])
    setSelectedTextId(newText.id)
    setNewTextContent("")

    // Add to history
    setTimeout(() => {
      if (!canvasRef.current) return
      addToHistory(canvasRef.current.toDataURL(`image/${imageFormat}`, imageQuality / 100))
    }, 100)
  }

  // Update selected text element
  const updateSelectedText = () => {
    if (!selectedTextId) return

    setTextElements((prev) =>
      prev.map((textEl) => {
        if (textEl.id === selectedTextId) {
          return {
            ...textEl,
            content: newTextContent || textEl.content,
            size: newTextSize,
            color: newTextColor,
          }
        }
        return textEl
      }),
    )

    // Add to history
    setTimeout(() => {
      if (!canvasRef.current) return
      addToHistory(canvasRef.current.toDataURL(`image/${imageFormat}`, imageQuality / 100))
    }, 100)
  }

  // Delete selected text element
  const deleteSelectedText = () => {
    if (!selectedTextId) return

    setTextElements((prev) => prev.filter((textEl) => textEl.id !== selectedTextId))
    setSelectedTextId(null)

    // Add to history
    setTimeout(() => {
      if (!canvasRef.current) return
      addToHistory(canvasRef.current.toDataURL(`image/${imageFormat}`, imageQuality / 100))
    }, 100)
  }

  // Apply crop
  const applyCrop = () => {
    if (!canvasRef.current || !image) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const x = Math.min(cropStart.x, cropEnd.x)
    const y = Math.min(cropStart.y, cropEnd.y)
    const width = Math.abs(cropEnd.x - cropStart.x)
    const height = Math.abs(cropEnd.y - cropStart.y)

    if (width === 0 || height === 0) return

    // Create a new canvas with the cropped dimensions
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext("2d")
    if (!tempCtx) return

    // Draw the original image onto the temporary canvas
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Draw only the cropped portion
      tempCtx.drawImage(img, x, y, width, height, 0, 0, width, height)

      // Update image dimensions
      setImageWidth(width)
      setImageHeight(height)
      setAspectRatio(width / height)

      // Update image with cropped version
      const croppedImage = tempCanvas.toDataURL(`image/${imageFormat}`, imageQuality / 100)
      setImage(croppedImage)

      // Adjust text positions for the new cropped image
      setTextElements((prev) =>
        prev.map((textEl) => ({
          ...textEl,
          position: {
            x: Math.max(0, Math.min(width, textEl.position.x - x)),
            y: Math.max(0, Math.min(height, textEl.position.y - y)),
          },
        })),
      )

      // Add to history
      addToHistory(croppedImage)

      // Exit crop mode
      setCropMode(false)
    }
    img.src = image
  }

  // Resize image
  const resizeImage = () => {
    if (!canvasRef.current || !image) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Create a new canvas with the new dimensions
      const tempCanvas = document.createElement("canvas")
      tempCanvas.width = imageWidth
      tempCanvas.height = imageHeight
      const tempCtx = tempCanvas.getContext("2d")
      if (!tempCtx) return

      tempCtx.drawImage(img, 0, 0, imageWidth, imageHeight)

      // Update image with resized version
      const resizedImage = tempCanvas.toDataURL(`image/${imageFormat}`, imageQuality / 100)
      setImage(resizedImage)

      // Add to history
      addToHistory(resizedImage)
    }
    img.src = image
  }

  // Handle width change with aspect ratio
  const handleWidthChange = (newWidth: number) => {
    setImageWidth(newWidth)
    if (maintainAspectRatio) {
      setImageHeight(Math.round(newWidth / aspectRatio))
    }
  }

  // Handle height change with aspect ratio
  const handleHeightChange = (newHeight: number) => {
    setImageHeight(newHeight)
    if (maintainAspectRatio) {
      setImageWidth(Math.round(newHeight * aspectRatio))
    }
  }

  // Rotate image
  const rotateImage = () => {
    setRotation((prev) => (prev + 90) % 360)

    // If rotation is 90 or 270 degrees, swap width and height
    if ((rotation + 90) % 180 === 90) {
      const temp = imageWidth
      setImageWidth(imageHeight)
      setImageHeight(temp)
      setAspectRatio(1 / aspectRatio)
    }

    // Add to history after the image is redrawn
    setTimeout(() => {
      if (!canvasRef.current) return
      addToHistory(canvasRef.current.toDataURL(`image/${imageFormat}`, imageQuality / 100))
    }, 100)
  }

  // Flip image horizontally
  const flipHorizontal = () => {
    if (!canvasRef.current || !image) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      ctx.save()
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // Flip context horizontally from the center
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      // Draw the image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      ctx.restore()

      // Update image data
      const newImageData = canvas.toDataURL(`image/${imageFormat}`, imageQuality / 100)
      setImage(newImageData)
      // Add to history
      addToHistory(newImageData)
    }
    img.src = image
  }

  // Flip image vertically
  const flipVertical = () => {
    if (!canvasRef.current || !image) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      ctx.save()
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // Flip context vertically from the center
      ctx.translate(0, canvas.height)
      ctx.scale(1, -1)
      // Draw the image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      ctx.restore()

      // Update image data
      const newImageData = canvas.toDataURL(`image/${imageFormat}`, imageQuality / 100)
      setImage(newImageData)
      // Add to history
      addToHistory(newImageData)
    }
    img.src = image
  }

  // Apply adjustments (brightness, contrast, saturation)
  const applyAdjustments = () => {
    if (!canvasRef.current) return

    // Add to history
    addToHistory(canvasRef.current.toDataURL(`image/${imageFormat}`, imageQuality / 100))
  }

  // Add to history
  const addToHistory = (newImage: string) => {
    // Remove any forward history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newImage)

    // Limit history to 20 items
    if (newHistory.length > 20) {
      newHistory.shift()
    }

    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  // Undo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setImage(history[historyIndex - 1])
    }
  }

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setImage(history[historyIndex + 1])
    }
  }

  // Reset image to original
  const resetImage = () => {
    if (originalImage) {
      // Create a new Image to get the original dimensions
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        // Reset image and dimensions
        setImage(originalImage)
        setImageWidth(img.width)
        setImageHeight(img.height)
        setAspectRatio(img.width / img.height)

        // Reset all adjustments
        setBrightness(100)
        setContrast(100)
        setSaturation(100)
        setRotation(0)

        // Reset text
        setTextElements([])
        setSelectedTextId(null)
        setNewTextContent("")
        setNewTextSize(20)
        setNewTextColor("#000000")

        // Reset crop
        setCropMode(false)
        setCropStart({ x: 0, y: 0 })
        setCropEnd({ x: 0, y: 0 })

        // Add to history
        addToHistory(originalImage)
      }
      img.src = originalImage
    }
  }

  // Download image
  const downloadImage = () => {
    if (!canvasRef.current) return

    // 生成时间戳字符串
    const now = new Date()
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0')

    const link = document.createElement("a")
    link.download = `EditMyImage.online_${timestamp}.${imageFormat}`
    link.href = canvasRef.current.toDataURL(`image/${imageFormat}`, imageQuality / 100)
    link.click()
  }

  // Update text form when selected text changes
  useEffect(() => {
    if (selectedText) {
      setNewTextContent(selectedText.content)
      setNewTextSize(selectedText.size)
      setNewTextColor(selectedText.color)
    } else {
      setNewTextContent("")
      setNewTextSize(20)
      setNewTextColor("#000000")
    }
  }, [selectedText])

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              asChild
            >
              <a
                href="https://github.com/lisenhuang/edit-my-image-online"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
            <ThemeLanguageSwitcher />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left sidebar with tools */}
            <div className="w-full md:w-64 space-y-4">
              <Button variant="outline" className="w-full justify-start" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> {t("upload")}
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

              <Tabs defaultValue="resize" className="w-full">
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="resize">
                    <ImageIcon className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="crop">
                    <Crop className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="adjust">
                    <Sliders className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <Type className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="resize" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="width">{t("width")}</Label>
                    <Input
                      id="width"
                      type="number"
                      value={imageWidth}
                      onChange={(e) => handleWidthChange(Number(e.target.value))}
                      disabled={!image}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">{t("height")}</Label>
                    <Input
                      id="height"
                      type="number"
                      value={imageHeight}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                      disabled={!image}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="aspectRatio"
                      checked={maintainAspectRatio}
                      onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                      disabled={!image}
                    />
                    <Label htmlFor="aspectRatio">{t("maintainAspectRatio")}</Label>
                  </div>
                  <Button onClick={resizeImage} disabled={!image} className="w-full">
                    {t("applyResize")}
                  </Button>
                  <div className="flex gap-2">
                    <Button onClick={rotateImage} disabled={!image} variant="outline" className="flex-1">
                      <RotateCw className="h-4 w-4 mr-2" /> {t("rotate")}
                    </Button>
                    <Button onClick={flipHorizontal} disabled={!image} variant="outline" className="flex-1">
                      <FlipHorizontal className="h-4 w-4" />
                    </Button>
                    <Button onClick={flipVertical} disabled={!image} variant="outline" className="flex-1">
                      <FlipVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="crop" className="space-y-4">
                  <Button
                    onClick={() => setCropMode(!cropMode)}
                    disabled={!image}
                    variant={cropMode ? "default" : "outline"}
                    className="w-full"
                  >
                    <Scissors className="h-4 w-4 mr-2" />
                    {cropMode ? t("cancelCrop") : t("startCrop")}
                  </Button>
                  {cropMode && (
                    <Button onClick={applyCrop} disabled={!image} className="w-full">
                      {t("applyCrop")}
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="adjust" className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="brightness">{t("brightness")}</Label>
                      <span>{brightness}%</span>
                    </div>
                    <Slider
                      id="brightness"
                      min={0}
                      max={200}
                      step={1}
                      value={[brightness]}
                      onValueChange={(value) => setBrightness(value[0])}
                      disabled={!image}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="contrast">{t("contrast")}</Label>
                      <span>{contrast}%</span>
                    </div>
                    <Slider
                      id="contrast"
                      min={0}
                      max={200}
                      step={1}
                      value={[contrast]}
                      onValueChange={(value) => setContrast(value[0])}
                      disabled={!image}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="saturation">{t("saturation")}</Label>
                      <span>{saturation}%</span>
                    </div>
                    <Slider
                      id="saturation"
                      min={0}
                      max={200}
                      step={1}
                      value={[saturation]}
                      onValueChange={(value) => setSaturation(value[0])}
                      disabled={!image}
                    />
                  </div>
                  <Button onClick={applyAdjustments} disabled={!image} className="w-full">
                    {t("applyAdjustments")}
                  </Button>
                </TabsContent>

                <TabsContent value="text" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="text">{t("text")}</Label>
                    <Input
                      id="text"
                      value={newTextContent}
                      onChange={(e) => setNewTextContent(e.target.value)}
                      disabled={!image}
                      placeholder={t("text")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="textSize">{t("textSize")}</Label>
                    <Input
                      id="textSize"
                      type="number"
                      value={newTextSize}
                      onChange={(e) => setNewTextSize(Number(e.target.value))}
                      disabled={!image}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="textColor">{t("textColor")}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="textColor"
                        type="color"
                        value={newTextColor}
                        onChange={(e) => setNewTextColor(e.target.value)}
                        disabled={!image}
                        className="w-12 h-10 p-1"
                      />
                      <Input value={newTextColor} onChange={(e) => setNewTextColor(e.target.value)} disabled={!image} />
                    </div>
                  </div>

                  {selectedTextId ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button onClick={updateSelectedText} disabled={!image} className="flex-1">
                          {t("updateText")}
                        </Button>
                        <Button onClick={deleteSelectedText} disabled={!image} variant="destructive" className="flex-1">
                          <Trash2 className="h-4 w-4 mr-2" /> {t("delete")}
                        </Button>
                      </div>
                      <Button
                        onClick={() => setSelectedTextId(null)}
                        disabled={!image}
                        variant="outline"
                        className="w-full"
                      >
                        {t("deselect")}
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={addTextElement} disabled={!image || !newTextContent.trim()} className="w-full">
                      <Plus className="h-4 w-4 mr-2" /> {t("addText")}
                    </Button>
                  )}

                  {textElements.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">
                        {t("textElements")} ({textElements.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {textElements.map((textEl) => (
                          <div
                            key={textEl.id}
                            className={`p-2 border rounded-md cursor-pointer text-sm truncate ${selectedTextId === textEl.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
                                : ""
                              }`}
                            onClick={() => setSelectedTextId(textEl.id)}
                            style={{ color: textEl.color }}
                          >
                            {textEl.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="format">{t("outputFormat")}</Label>
                <Select value={imageFormat} onValueChange={setImageFormat}>
                  <SelectTrigger id="format">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="quality">{t("quality")}</Label>
                  <span>{imageQuality}%</span>
                </div>
                <Slider
                  id="quality"
                  min={10}
                  max={100}
                  step={1}
                  value={[imageQuality]}
                  onValueChange={(value) => setImageQuality(value[0])}
                  disabled={!image || imageFormat === "png"}
                />
              </div>
            </div>

            {/* Main canvas area */}
            <div className="flex-1 flex flex-col items-center">
              <div className="relative border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 w-full h-[500px] flex items-center justify-center">
                {image ? (
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <div className="text-center p-8">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("noImage")}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("uploadToStart")}</p>
                    <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> {t("upload")}
                    </Button>
                  </div>
                )}
              </div>

              {/* History and download controls */}
              {image && (
                <div className="flex flex-wrap justify-between w-full mt-4 gap-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={undo} disabled={historyIndex <= 0}>
                      <Undo className="h-4 w-4 mr-2" /> {t("undo")}
                    </Button>
                    <Button variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1}>
                      <Redo className="h-4 w-4 mr-2" /> {t("redo")}
                    </Button>
                    <Button variant="outline" onClick={resetImage}>
                      {t("reset")}
                    </Button>
                  </div>
                  <Button onClick={downloadImage}>
                    <Download className="h-4 w-4 mr-2" /> {t("download")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

