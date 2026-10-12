package com.gatxel.kira

import android.content.Context
import android.util.AttributeSet
import android.widget.LinearLayout

/** LinearLayout dengan lebar maksimum, supaya formulir tidak melebar penuh di tablet landscape. */
class MaxWidthLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : LinearLayout(context, attrs) {

    private val maxWidth = resources.getDimensionPixelSize(R.dimen.content_max_width)

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val spec = if (width > maxWidth) MeasureSpec.makeMeasureSpec(maxWidth, MeasureSpec.EXACTLY) else widthMeasureSpec
        super.onMeasure(spec, heightMeasureSpec)
    }
}
