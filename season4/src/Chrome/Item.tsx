import React, { ReactNode, RefObject } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  scrollTo,
  Easing,
  withTiming,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";

import { Positions } from "./Config";
import { useSharedValue } from "./Animations";
const config = { easing: Easing.inOut(Easing.ease), duration: 350 };

const { height: containerHeight } = Dimensions.get("window");

const getPosition = (
  position: number,
  numberOfColumns: number,
  width: number,
  height: number
) => {
  "worklet";
  return {
    x: position % numberOfColumns === 0 ? 0 : width,
    y: Math.floor(position / numberOfColumns) * height,
  };
};

const getOrder = (
  tx: number,
  ty: number,
  numberOfColumns: number,
  width: number,
  height: number,
  max: number
) => {
  "worklet";

  const x = Math.round(tx / width) * width;
  const y = Math.round(ty / height) * height;
  const row = Math.max(y, 0) / height;
  const col = Math.max(x, 0) / width;
  return Math.min(row * numberOfColumns + col, max);
};

interface ItemProps {
  children: ReactNode;
  positions: Animated.SharedValue<Positions>;
  id: string;
  width: number;
  height: number;
  editing: boolean;
  onDragEnd: (diffs: Positions) => void;
  numberOfColumns: number;
  scrollView: RefObject<Animated.ScrollView>;
  scrollY: Animated.SharedValue<number>;
}

const Item = ({
  children,
  positions,
  id,
  width,
  numberOfColumns,
  height,
  editing,
  onDragEnd,
  scrollView,
  scrollY,
}: ItemProps) => {
  const contentHeight =
    (Object.keys(positions.value).length / numberOfColumns + 1) * height;
  const isGestureActive = useSharedValue(false);
  const editingSharedValue = useSharedValue(true);
  const position = getPosition(
    positions.value[id],
    numberOfColumns,
    width,
    height
  );
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  useAnimatedReaction(
    () => {
      console.log(id);
      return positions.value[id];
    },
    (newOrder: number) => {
      if (!isGestureActive.value) {
        const pos = getPosition(newOrder, numberOfColumns, width, height);
        translateX.value = withTiming(pos.x, config);
        translateY.value = withTiming(pos.y, config);
      }
    }
  );
  const onGestureEvent = useAnimatedGestureHandler<{ x: number; y: number }>({
    onStart: (_, ctx) => {
      // dont allow drag start if we're done editing
      if (editingSharedValue.value) {
        ctx.x = translateX.value;
        ctx.y = translateY.value;
        isGestureActive.value = true;
      }
    },
    onActive: ({ translationX, translationY }, ctx) => {
      // dont allow drag if we're done editing
      if (editingSharedValue.value) {
        translateX.value = ctx.x + translationX;
        translateY.value = ctx.y + translationY;
        // 1. We calculate where the tile should be
        const newOrder = getOrder(
          translateX.value,
          translateY.value,
          numberOfColumns,
          width,
          height,
          Object.keys(positions.value).length - 1
        );

        // 2. We swap the positions
        const oldOlder = positions.value[id];
        if (newOrder !== oldOlder) {
          const idToSwap = Object.keys(positions.value).find(
            (key) => positions.value[key] === newOrder
          );
          if (idToSwap) {
            console.log(
              JSON.stringify({ id, idToSwap, newOrder, oldOlder }, null, 2)
            );
            const newPositions = Object.assign({}, positions.value);
            newPositions[id] = newOrder;
            newPositions[idToSwap] = oldOlder;
            positions.value = newPositions;
          }
        }

        // 3. Scroll up and down if necessary
        const lowerBound = scrollY.value;
        const upperBound = lowerBound + containerHeight - height;
        const maxScroll = contentHeight - containerHeight;
        const leftToScrollDown = maxScroll - scrollY.value;
        if (translateY.value < lowerBound) {
          const diff = Math.min(lowerBound - translateY.value, lowerBound);
          scrollTo(scrollView, 0, scrollY.value - diff, false);
          ctx.y -= diff;
          translateY.value = ctx.y + translationY;
        }
        if (translateY.value > upperBound) {
          const diff = Math.min(
            translateY.value - upperBound,
            leftToScrollDown
          );
          scrollTo(scrollView, 0, scrollY.value + diff, false);
          ctx.y += diff;
          translateY.value = ctx.y + translationY;
        }
      }
    },
    onEnd: () => {
      const destination = getPosition(
        positions.value[id],
        numberOfColumns,
        width,
        height
      );
      translateX.value = withTiming(destination.x, config, () => {
        isGestureActive.value = false;
        //onDragEnd(positions.value);
      });
      translateY.value = withTiming(destination.y, config);
    },
  });
  const style = useAnimatedStyle(() => {
    const zIndex = isGestureActive.value ? 100 : 0;
    const scale = withSpring(isGestureActive.value ? 1.05 : 1);
    return {
      position: "absolute",
      top: 0,
      left: 0,
      width,
      height,
      zIndex,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale },
      ],
    };
  });
  return (
    <Animated.View style={style}>
      <PanGestureHandler enabled={editing} onGestureEvent={onGestureEvent}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <View
            style={{ backgroundColor: "red", ...StyleSheet.absoluteFillObject }}
          />
        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  );
};

export default Item;
